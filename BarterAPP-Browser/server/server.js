﻿require('rootpath')
var express = require('express')
var app = express()
var cors = require('cors')
var bodyParser = require('body-parser')
var expressJwt = require('express-jwt')
var config = require('config.json')

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// JWT auth para asegurar la app

// schedule
// app.use(expressJwt({ secret: config.secret }).unless({ path: ['/users/authenticate', '/users/register','/schedule/create','/schedule/delete','/schedule/move','/schedule','/event/create','/event/delete','/event/move','/event/frees','/events',/^\/events(\/w*)*/] }));
app.use(expressJwt({ secret: config.secret }).unless({ path: ['/users/authenticate', '/users/register', /^\/events(\/w*)*/, /^\/company(\/w*)*/, /^\/interchange(\/w*)*/]}))

// rutas
var routesEvent = require('./routes/event.router')
routesEvent(app) // pasa el objeto a la app para enlazar la ruta
var routesInterchange = require('./routes/interchange.router')
routesInterchange(app)

app.use('/users', require('./controllers/users.controller'))
app.use('/schedule', require('./controllers/schedules.controller'))
// app.use('/event', require('./controllers/event.controller'));

// inicio servidor
var port = process.env.NODE_ENV === 'production' ? 80 : 4000
var server = app.listen(port, function () {
  console.log('Server listening on port ' + port)
})