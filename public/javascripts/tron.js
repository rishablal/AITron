var INTERVAL = 10;
var leaveGameListener;
var startGameListener;
var joinGameListener;

function elt(type) {
	const ele = document.createElement(type);
	for (let i = 1; i < arguments.length; i++) {
		let child = arguments[i];
		if (typeof child === 'string') {
			child = document.createTextNode(child);
		}
		ele.appendChild(child);
	}
	return ele;
}

function Game(socket, gameInfo, w, h) {
	this.localPlayer = socket.user;
	this.host = gameInfo[this.localPlayer].host;
	this.players = gameInfo;
	this.players[this.localPlayer].initialPosition = this.players[this.localPlayer].pos;
	this.width = w;
	this.height = h;
	this.canvas = document.querySelector('.gameCanvas');
	this.canvas.width = w;
	this.canvas.height = h;
	this.socket = socket;
	this.ready = false;
	this.timer = 0;

	this.initPositions();

	var g = this;
	this.loop = setInterval(function() {
		g.mainLoop(g);
	}, INTERVAL);
}

Game.prototype = {
	mainLoop: function(g) {
		if (g.ready) {
			g.sendData();
		}
	},

	sendData: function() {
		this.removedPlayers = [];
		this.socket.emit('getData', { 'host': this.host, 'player': this.localPlayer, 'timer': this.timer });
	},

	newGameBtnClick: function(evt) {
		for (let p in this.players) {
			const cur = this.players[p];
			cur.pos = cur.initialPosition;
			cur.direction = [];
			cur.live = true;
			this.players[p] = cur;
		}
		this.socket.emit('restartGame', { 'host': this.host, 'players': this.players });
	},

	updateMongo: function(user, isWinner) {
		const req = new XMLHttpRequest();
		req.open('POST', '/user/', true);
		req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		req.send(`user=${user}&isWinner=${isWinner}`);
	},

	getWinner: function() {
		let livePlayers = [];
		for (let p in this.players) { 
			if (this.players[p].live) {
				livePlayers.push(this.players[p].player);
			} 
		};

		let gameEnd = false;
		let winners;
		let winnerDiv;
		switch (livePlayers.length) {
			case 1:
				console.log('winner: ', livePlayers);
				if (livePlayers[0] === this.localPlayer) {
					this.updateMongo(livePlayers[0], 1);
					for (let p in this.players) {
						if (p !== livePlayers[0]) {
							this.updateMongo(p, 0);
						}
					}
				}
				winnerDiv = elt('div', elt('h2', `Winner: ${livePlayers[0]}`));
				this.incrementPoints(livePlayers[0]);
				gameEnd = true;
				break;
			case 0:
				console.log('tie: ', this.removedPlayers);
				winnerDiv = elt('div', elt('h2', `Draw!`));
				gameEnd = true;
				break;
			default: break;
		}
		if (gameEnd) {
			this.ready = false;
			winnerDiv.id = 'winnerDiv';
			if (this.localPlayer === this.host) {
				const newGameBtn = elt('button', 'Play Again');
				newGameBtn.addEventListener('click', this.newGameBtnClick.bind(this));
				winnerDiv.appendChild(newGameBtn);
			}
			document.querySelector('.game').appendChild(winnerDiv);
			document.querySelector('#leaveGameBtn').disabled = false;
			clearInterval(this.loop);
		}
	},

	incrementPoints: function(player) {
		document.querySelector(`#${player}ScoreDiv`).innerText = (++this.players[player].score).toString();
	},

	updatePosition: function(p, direction) {
		let player = this.players[p];
		let x = player.pos[0];
		let y = player.pos[1];
		x += (direction[0] * 10);
		y += (direction[1] * 10);

		if (this.canvas.getContext) {
			let ctx = this.canvas.getContext('2d');
			let newPos = ctx.getImageData(x, y, 1, 1).data;
			if (newPos[0] === 0 && newPos[1] === 0 && newPos[2] === 0) {
				ctx.fillStyle = player.color;
				ctx.fillRect(x, y, 10, 10);
			}
			// collision
			else {
				console.log('collision');
				player.live = false;
				this.removedPlayers.push(player);
			}
		}

		// out of bounds
		if (x <= 0 || x >= this.width || y <= 0 || y >= this.height) {
			console.log('out of bounds');
			player.live = false;
			this.removedPlayers.push(player);
		}

		this.players[p].pos = [x, y];
		this.players[p].live = player.live;
	},

	getCollisions: function() {
		for (let p1 in this.players) {
			for (let p2 in this.players) {
				let remPlayers = Array.prototype.map.call(this.removedPlayers, (cur) => { return cur.player; });
				if (p1 !== p2 && (!remPlayers.includes(p1) || !remPlayers.includes(p2))) {
					let player1 = this.players[p1].pos;
					let player2 = this.players[p2].pos;

					// collision
					if ((Math.abs(player1[0] - player2[0]) <= 5) && (Math.abs(player1[1] - player2[1]) <= 5)) {
						player1.live = false;
						player2.live = false;
						this.removedPlayers.push(player1);
						this.removedPlayers.push(player2);
						console.log('multi collision');
					}
				}
			}
		}
	},

	initPositions: function() {
		if (this.canvas.getContext) {
			let ctx = this.canvas.getContext('2d');

			for(let key in this.players) {
				let cur = this.players[key];
				ctx.fillStyle = cur.color;
				ctx.fillRect(cur.pos[0], cur.pos[1], 10, 10);
			}
		}
	}
}

function Lobby(socket) {
	this.users = [];
	this.games = {};
	this.lobby = document.querySelector('.lobby');
	this.socket = socket;
	this.view = 'mainView';
	this.viewHost = '';
	this.profiles = {};
	// view = mainView, highScoresView, gameInfoView, gameView
}


Lobby.prototype = {
	addUser: function(user) {
		let isSynced = true;
		if (user.isLocal) {
			this.localUser = user.user;
			this.users.push(this.localUser);
			isSynced = false;
		}
		else {
			if (!this.users.includes(user.user)) {
				this.users.push(user.user);
				isSynced = false;
			}
			this.socket.emit('syncLobby', this.localUser, this.localGame !== undefined ? this.localGame : undefined, this.profiles[this.localUser]);
		}
		if (!isSynced) {
			this.profiles[user.user] = user.profile;
			this.updateElements();
		}
	},

	addGame: function(game) {
		let isSynced = true;
		if (!this.games.hasOwnProperty(game.host)) {
			this.games[game.host] = { 'host': game.host, 'players': game.players };
			isSynced = false;
		}
		if (!isSynced) {
			this.updateElements();
		}
	},

	displayError: function(message) {
		let errorDiv = document.querySelector('.errorDiv');
		if (message) {
			errorDiv.style.display = 'inline-block';
			errorDiv.innerText = message;
		}
		else {
			errorDiv.style.display = 'none';
		}
	},

	startGameClick: function(evt) {
		let locGame = this.games[this.localUser]; 
		if (locGame.players.length < 2) {
			this.displayError('Need at least 2 players to start game.');
		}
		else {
			this.displayError();
			this.socket.emit('startGame', { 'host': locGame.host, 'players': locGame.players });
		}
	},

	leaveGameClick(evt) {
		this.socket.emit('leaveGame', { 'host': this.localGame, 'player': this.localUser });
		this.localGame = undefined;
	},

	joinGameClick: function(lobby, evt) {
		if (!lobby.localGame) {
			let playerDivs = document.querySelector('#players');
			let playerAlreadyJoined = false;
			let idx = -1;
			let curIdx = 0;
			Array.prototype.forEach.call(playerDivs.children, (cur) => {
				if (idx < 0) {
					if (cur.innerText === 'Waiting...') {
						idx = curIdx;
					}
					if (cur.innerText === lobby.localUser) {
						playerAlreadyJoined = true;
					}
				}
				curIdx++;
			});
			if (!playerAlreadyJoined) {
				if (idx > -1) {
					let host = document.querySelector('#host').innerText;
					host = host.substring(6, host.length);
					lobby.localGame = host;
					lobby.socket.emit('joinGame', { 'host': host, 'player': lobby.localUser, 'idx': idx });
					lobby.displayError();
					document.querySelector('#joinGameBtn').style.display = 'none';
					const leaveGameBtn = document.querySelector('#leaveLobbyGameBtn');
					leaveGameBtn.style.display = 'inline-block';
				}
				else {
					lobby.displayError('Game is full.');
				}
			}
		}
	},

	showGameInfoView: function(host, players) {
		this.view = 'gameInfoView';
		this.viewHost = host;
		lobby.displayError();
		document.querySelector('.mainView').style.display = 'none';
		document.querySelector('.highScoresView').style.display = 'none';
		const gameInfoView = document.querySelector('.gameInfoView');
		gameInfoView.style.display = 'inline-block';
		document.querySelector('#host').innerText = `Host: ${host}`;

		const joinGameBtn = document.querySelector('#joinGameBtn');
		const leaveGameBtn = document.querySelector('#leaveLobbyGameBtn');
		const startGameBtn = document.querySelector('#startGameBtn');
		if (this.localGame === host) {
			document.querySelector('#infoTitle').innerText = 'Create Game';
			joinGameBtn.style.display = 'none';
			leaveGameBtn.style.display = 'inline-block';
			startGameBtn.style.display = 'inline-block';
			if (leaveGameListener) {
				leaveGameBtn.removeEventListener('click', leaveGameListener);
			}
			if (startGameListener) {
				startGameBtn.removeEventListener('click', startGameListener);
			}
			leaveGameListener = this.leaveGameClick.bind(this);
			startGameListener = this.startGameClick.bind(this);
			leaveGameBtn.addEventListener('click', leaveGameListener);
			startGameBtn.addEventListener('click', startGameListener);
		}
		else {
			document.querySelector('#infoTitle').innerText = 'Join Game';
			if (this.localGame === host) {
				joinGameBtn.style.display = 'none';
				leaveGameBtn.style.display = 'inline-block';
				if (leaveGameListener) {
					leaveGameBtn.removeEventListener('click', leaveGameListener);
				}
				leaveGameListener = this.leaveGameClick.bind(this);
				leaveGameBtn.addEventListener('click', leaveGameListener);
			}
			else {
				leaveGameBtn.style.display = 'none';
				joinGameBtn.style.display = 'inline-block';
				if (joinGameListener) {
					joinGameBtn.removeEventListener('click', joinGameListener);
				}
				joinGameListener = this.joinGameClick.bind(joinGameBtn, this);
				joinGameBtn.addEventListener('click', joinGameListener);
			}
			startGameBtn.style.display = 'none';
		}
	
		let p = 0;
		Array.prototype.forEach.call(document.querySelector('#players').children, (cur) => {
			if (players[p]) {
				cur.innerText = players[p];
			}
			else {
				cur.innerText = 'Waiting...';
			}
			p++;
		});
	},

	createGameInfoView: function(lobby, evt) {
		lobby.showGameInfoView(this.id, lobby.games[this.id].players);
	},

	updateElements: function() {
		let userCol = this.lobby.querySelector('#userCol');
		let gameCol = this.lobby.querySelector('#gameCol');
		let curUsers = [];
		let curGames = [];
		let updateUsers = [];
		let updateGames = [];

		userCol.querySelectorAll('.userDiv').forEach((cur) => {
			// remove disconnected users
			if (!this.users.includes(cur.innerText)) {
				userCol.removeChild(cur);
			}
			else {
				curUsers.push(cur.innerText);
			}
		});

		gameCol.querySelectorAll('.gameDiv').forEach((cur) => {
			// remove disconnected games
			let gameAdded = false;
			for (let host in this.games) {
				if (host === cur.id) {
					gameAdded = true;
				}
			}
			if (gameAdded) {
				curGames.push(cur.id);
			}
			else {
				gameCol.removeChild(cur);
			}
		});

		// new users
		this.users.forEach((cur) => {
			if (!curUsers.includes(cur)) {
				updateUsers.push(cur);
			}
		});

		// new games
		for (let host in this.games) {
			if (!curGames.includes(host)) {
				updateGames.push(host);
			}
		}

		updateUsers.forEach((cur) => {
			const userDiv = elt('div', cur);
			userDiv.className = 'userDiv';
			const imgElem = document.createElement('img');
			imgElem.className = 'profileIcon';
			imgElem.src = this.profiles[cur];
			userDiv.appendChild(elt('text', '	'));
			userDiv.appendChild(imgElem);
			userCol.appendChild(userDiv);
		});

		updateGames.forEach((cur) => {
			const gameDiv = elt('div', elt('h3', `Host: ${cur}`));
			gameDiv.className = 'gameDiv';
			gameDiv.id = cur;
			gameDiv.addEventListener('click', this.createGameInfoView.bind(gameDiv, this));
			gameCol.appendChild(gameDiv);
		});
	}
}