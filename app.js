require('./db');
require('./auth');
const passport = require('passport');
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const UserInfo = mongoose.model('UserInfo');

// TODO: this block may need to move to www/ in production
const server = require('http').createServer(app);
var io = require('socket.io')(server);
const port = process.env.PORT || 8080;
server.listen(port, () => {
	console.log('Server listening at port %d', port);
});

const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const tron = require('./routes/tron');
const index = require('./routes/index');
const users = require('./routes/users');


const session = require('express-session');
const sessionOptions = {
	secret: 'TODO:createSecret',
	resave: true,
	saveUninitialized: true
};
app.use(session(sessionOptions));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
	res.locals.user = req.user;
	next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// redirect authenticated/unauthenticated users
app.use(function(req, res, next) {
	switch (req.path) {
		case '/':
		case '/register':
		case '/about': 
			next();
			break;
		case '/signIn':
			if (req.isAuthenticated()) {
				res.redirect('/tron');
			} 
			else {
				next();
			}
			break;
		default:
			if (!req.isAuthenticated()) { 
				res.redirect('/');
			}
			else {
				next();
			}
			break;
	}
});

app.use('/', index);
app.use('/user', users);
app.use('/tron', tron);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  console.log(err.message);

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


function Game(players) {
	this.next = {};
	this.directions = {};
	this.live = {};
	this.timer = 0;
	this.updating = false;
	this.directions[this.timer] = {};
	this.nextDirections = {};
	for (let p in players) {
		this.next[p] = false;
		this.directions[this.timer][p] = [];
		this.nextDirections[p] = [];
		this.live[p] = true;
	}
}

const Games = {};

io.on('connection', function(socket) {
	socket.user = socket.handshake.query.user;
	console.log('connected user: ', socket.user);
	UserInfo.findOne({'user': socket.user}, (err, userInfo) => {
		let profile = '';
		if (userInfo) {
			profile = userInfo.profile;
		}
		socket.emit('addUser', { 'user': socket.user, 'isLocal': true, 'profile': profile });
		socket.broadcast.emit('addUser', { 'user': socket.user, 'isLocal': false, 'profile': profile });
	});

	socket.on('syncLobby', function(user, game, profile) {
		socket.broadcast.emit('syncLobby', user, game, profile);
	});

	socket.on('createGame', function(game) {
		socket.broadcast.emit('addGame', game);
		socket.join(game.host);
	});

	socket.on('joinGame', function(userInfo) {
		socket.join(userInfo.host);
		socket.emit('joinGame', userInfo);
		socket.broadcast.emit('joinGame', userInfo);
	});

	socket.on('leaveGame', function(playerInfo) {
		console.log('leave game: ', playerInfo);
		socket.leave(playerInfo.host);
		socket.emit('leaveGame', playerInfo);
		socket.broadcast.emit('leaveGame', playerInfo);
		if (playerInfo.host === playerInfo.player) {
			io.sockets.in(playerInfo.player).clients(function(err, clients) {
				if (err) {
					throw err;
				}
				else {
					for (let i = 0; i < clients.length; i++) {
						io.sockets.connected[clients[i]].leave(playerInfo.host);
					}
				}
			});
		}
	});

	socket.on('startGame', function(gameInfo) {
		let initPositions = [[200, 450], [450, 200], [450, 450], [200, 200]];
		let colors = ['red', 'blue', 'green', 'orange'];
		let playerInit = {};
		let connected = io.of('/').in(gameInfo.host).clients().connected;
		for(let key in connected) {
			let cur = connected[key].user;
			playerInit[cur] = { 'pos': initPositions.pop(), 'color': colors.pop(), 'host': gameInfo.host, 'player': cur, 'direction': [], 'live': true, 'score': 0 };
		};
		Games[gameInfo.host] = new Game(playerInit);
		io.sockets.in(gameInfo.host).emit('startGame', { 'host': gameInfo.host, 'initPositions': playerInit });
	});

	socket.on('restartGame', function(gameInfo) {
		Games[gameInfo.host] = new Game(gameInfo.players);
		io.sockets.in(gameInfo.host).emit('restartGame', gameInfo.players);
	});

	socket.on('playerReady', function(playerInfo) {
		Games[playerInfo.host].directions[0][playerInfo.player] = playerInfo.direction;
		Games[playerInfo.host].nextDirections[playerInfo.player] = playerInfo.direction;
		io.sockets.in(playerInfo.host).emit('playerReady', playerInfo);
	});

	socket.on('directionChanged', function(playerInfo) {
		Games[playerInfo.host].nextDirections[playerInfo.player] = playerInfo.direction;
	});

	socket.on('getData', function(playerInfo) {
		if ((Games[playerInfo.host].timer + 1) === playerInfo.timer) {
			Games[playerInfo.host].next[playerInfo.player] = true;

			if (!Games[playerInfo.host].directions.hasOwnProperty(playerInfo.timer) && !Games[playerInfo.host].updating) {
				Games[playerInfo.host].updating = true;
				
				let readyCount = 0;
				for (let p in Games[playerInfo.host].next) {
					if (Games[playerInfo.host].live[p]) {
						if (Games[playerInfo.host].next[p]) {
							readyCount++;
						}
						else {
							break;
						}
					}
					else {
						readyCount++;
					}
				}
				
				if (readyCount === Object.keys(Games[playerInfo.host].next).length) { // or true? why?
					Games[playerInfo.host].timer++;
					Games[playerInfo.host].directions[Games[playerInfo.host].timer] = JSON.parse(JSON.stringify(Games[playerInfo.host].nextDirections));
					for (let p in Games[playerInfo.host].next) {
						Games[playerInfo.host].next[p] = false;
					}
				}
				Games[playerInfo.host].updating = false;
			}
		}
		if (Games[playerInfo.host].timer >= playerInfo.timer) {
			socket.emit('receiveData', Games[playerInfo.host].directions[playerInfo.timer]);
		}
		else {
			Games[playerInfo.host].next[playerInfo.player] = true;
		}
	});

	socket.on('disconnect', function() {
		console.log('disconnect: ', socket.user);
		socket.broadcast.emit('userDisconnect', socket.user);
	});
});

module.exports = app;
