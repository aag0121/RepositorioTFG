// Services: intercambio de los turnos
//    "requestor" : "UserA",   el que quiere cambiar (Persona que hace la peticion. Asignado Eliminar)
//    "acknowledger" : "UserB",  el que puede cambiar (Persona que recibe la peticion. Dia Libre)
//    "requestor_event_id" : ObjectId("592d4adef23ef815709076a3"),    desde que evento cambiar
//    "acknowledger_event_id" : ObjectId("592d79b077ece519bc534034"), por el evento que voy a cambiar
var config = require('../config.js');
var Q = require('q');
var mongo = require('mongoskin');
var db = mongo.db(config.connectionString, {});
// Se especifica que colecciones estamos usando
db.bind('interchange');
db.bind('event');
var shiftUtils = require("../utils/shift.utils");
var service = {};
// Peticion rechazada
service.decline = function (param) {
    var deferred = Q.defer();
    // console.log("Rechazado!!");
    var set = {
        status: 'normal'
    };
    // Cambiar las prioridad o estado del evento a "normal"
    db.event.updateById(param.idAcknowledgerEvent, { $set: set }, function (err, updatedEvent) {
        if (err)
            deferred.reject(err.name + ': ' + err.message);
        // console.log("--------------------Actualizar------------", updatedEvent);
        var query = { acknowledger: param.acknowledger, acknowledger_event_id: mongo.ObjectID.createFromHexString(param.idAcknowledgerEvent), status: "pending" };
        //console.log("itercambiar JSON= : " + JSON.stringify(query));
        // Obtener el objeto del intercambio para acceder al usuario que hace la peticion
        db.interchange.find({ 'acknowledger': param.acknowledger }).toArray(function (err, interchanges) {
            if (err)
                deferred.reject(err.name + ': ' + err.message);
            //console.log("Resultado: " +interchanges);
            var interchange;
            if (interchanges) {
                for (var i in interchanges) {
                    if (interchanges[i].status == "pending" && interchanges[i].acknowledger_event_id == param.idAcknowledgerEvent) {
                        //console.log("************************Intercambios: " + interchanges[i]);
                        interchange = interchanges[i];
                        break;
                    }
                }
                //console.log("--------------------Intercambio?: + " +JSON.stringify(interchanges[0]));
                deferred.resolve(interchange);
                set = {
                    status: 'declined'
                };
                //  Estado o prioridad establecido a rechazado
                db.interchange.updateById(interchange._id, { $set: set }, function (err) {
                    //console.log("----------Intercambio rechazado------------");
                    if (err)
                        deferred.reject(err.name + ': ' + err.message);
                });
                // Se avisa al usuario que hizo la peticion (requestor) que ha sido rechazado
                var set = {
                    status: shiftUtils.eventStatus.declined,
                    sender: param.acknowledger
                };
                db.event.updateById(interchange.requestor_event_id, { $set: set }, function (err, updated_requestor_event) {
                    if (err)
                        deferred.reject(err.name + ': ' + err.message);
                });
            }
            else {
                // console.log("Fin funcion rechazar");
                var emptyObject = {};
                deferred.resolve(emptyObject);
            }
        });
    });
    return deferred.promise;
};
// Peticion aceptada
service.accept_shift = function (param) {
    var deferred = Q.defer();
    var acknowledger_event = param;
    // obtener el objeto a intercambiar
    var query = { acknowledger: param.username };
    //console.log("itercambiar JSON= :" + JSON.stringify(query));
    db.interchange.find(query).toArray(function (err, interchanges) {
        if (err) {
            //console.log("0 error: " + err)
            deferred.reject(err.name + ': ' + err.message);
        }
        if (interchanges.length > 0) {
            var interchange;
            var findOne = false;
            for (var i in interchanges) {
                if (interchanges[i].status == "pending" && interchanges[i].acknowledger_event_id == param._id) {
                    //console.log("************************Intercambios: " + interchanges[i]);
                    interchange = interchanges[i];
                    findOne = true;
                    break;
                }
            }
            if (findOne == false) {
                var emptyObject = {};
                deferred.resolve(emptyObject);
                return deferred.promise;
            }
            // Obtener el evento del que hace la peticion (requestor)
            db.event.findById(interchange.requestor_event_id, function (err, requestor_event) {
                if (err) {
                    //console.log("1 error: " + err);
                    deferred.reject(err.name + ': ' + err.message);
                }
                // console.log('-----Evento del que hace la peticion:' + JSON.stringify(requestor_event));
                // Intercambio de los datos entre el que hace la peticion y el que la recibe
                set = {
                    title: requestor_event.title,
                    start: requestor_event.start,
                    end: requestor_event.end,
                    primary_color: shiftUtils.shiftColors.blue.primary,
                    secondary_color: shiftUtils.shiftColors.blue.secondary,
                    type: shiftUtils.shiftTypes.assigned,
                    status: shiftUtils.eventStatus.normal
                };
                //console.log("----------establecer colores-----------")
                db.event.updateById(acknowledger_event._id, { $set: set }, function (err, doc) {
                    if (err) {
                        //console.log("2 error: " + err);
                        deferred.reject(err.name + ': ' + err.message);
                    }
                });
                set = {
                    title: acknowledger_event.title,
                    start: acknowledger_event.start,
                    end: acknowledger_event.end,
                    primary_color: acknowledger_event.primary_color,
                    secondary_color: acknowledger_event.secondary_color,
                    type: acknowledger_event.type,
                    status: shiftUtils.eventStatus.accepted,
                    sender: acknowledger_event.username
                };
                db.event.updateById(requestor_event._id, { $set: set }, function (err, doc) {
                    if (err) {
                        //console.log("3 error: " + err);
                        deferred.reject(err.name + ': ' + err.message);
                    }
                });
                // Intercambio de los datos
                acknowledger_event.title = requestor_event.title,
                    acknowledger_event.start = requestor_event.start,
                    acknowledger_event.end = requestor_event.end,
                    acknowledger_event.primary_color = shiftUtils.shiftColors.blue.primary,
                    acknowledger_event.secondary_color = shiftUtils.shiftColors.blue.secondary,
                    acknowledger_event.type = shiftUtils.shiftTypes.assigned,
                    acknowledger_event.status = shiftUtils.eventStatus.normal;
                set = {
                    status: 'accepted'
                };
                // Se establece el estado como aceptado
                db.interchange.updateById(interchange._id, { $set: set }, function (err) {
                    //console.log("----------Intercambio aceptado------------");
                    if (err) {
                        //console.log("4 error: " + err);
                        deferred.reject(err.name + ': ' + err.message);
                    }
                });
                //console.log("JSON del que recibe la peticion " +JSON.stringify(acknowledger_event));
                deferred.resolve(acknowledger_event);
            });
        }
        else {
            //console.log("Fin funcion aceptar");
        }
    });
    return deferred.promise;
};
// Activar intercambio
service.activateShift = function (params) {
    var deferred = Q.defer();
    var query = { 'acknowledger': params.acknowledger, "acknowledger_event_id": mongo.ObjectID.createFromHexString(params.acknowledger_event_id), "status": "pending" };
    //console.log("Objeto a intercambiar = : " + JSON.stringify(query));
    //Obtener el objeto de intercambio de el usuario que hace la peticion
    db.interchange.findOne({ 'acknowledger': params.acknowledger }, function (err, interchange) {
        if (err)
            deferred.reject(err.name + ': ' + err.message);
        if (interchange) {
            //console.log("El objeto esta en la base de datos (Interchange Collection)  : ----------------- ");
            deferred.resolve(interchange);
            return deferred.promise;
        }
    });
    // Actualizacion en la base de datos
    db.interchange.insert(params, function (err, storedInterchange) {
        if (err)
            deferred.reject(err.name + ': ' + err.message);
        //El estado del evento (turno) de la persona que HACE la peticion pasa a  "required"
        set = {
            status: 'required'
        };
        //Se actualiza ese mismo evento en la base de datos
        db.event.updateById(params.requestor_event_id, { $set: set }, function (err, doc) {
            if (err)
                deferred.reject(err.name + ': ' + err.message);
        });
        //El estado del evento (turno) de la persona que RECIBE  la peticion pasa a estado: "pending"
        set = {
            status: 'pending',
            sender: params.requestor
        };
        db.event.updateById(params.acknowledger_event_id, { $set: set }, function (err, doc) {
            if (err)
                deferred.reject(err.name + ': ' + err.message);
        });
        deferred.resolve(storedInterchange);
    });
    return deferred.promise;
};
module.exports = service;
//# sourceMappingURL=interchange.service.js.map