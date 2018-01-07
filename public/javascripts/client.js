var socket;
var lobby;
var gameCanvas;
var tronGame;
var keydownListener;
var leaveGameListener;

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

function changeView(view) {
	switch (view) {
		case 'main':
			document.querySelector('.game').style.display = 'none';
			document.querySelector('.lobby').style.display = 'block';
			document.querySelector('.gameInfoView').style.display = 'none';
			document.querySelector('.highScoresView').style.display = 'none';
			document.querySelector('.mainView').style.display = 'inline-block';
			lobby.view = 'mainView';
			break;
		case 'game':
			document.querySelector('.lobby').style.display = 'none';
			document.querySelector('.highScoresView').style.display = 'none';
			document.querySelector('.game').style.display = 'inline-flex';
			lobby.view = 'gameView';
			break;
		case 'highScores':
			document.querySelector('.mainView').style.display = 'none';
			document.querySelector('.highScoresView').style.display = 'inline-block';
			lobby.view = 'highScoresView';
			break;
	}
}

function updateChildDiv(update, id, player) {
	if (gameCanvas) {
		delete gameCanvas.players[player];
	}
	let playerDivs = document.querySelector(id);
	let idx = -1;
	let curIdx = 0;
	Array.prototype.forEach.call(playerDivs.children, (cur) => {
		if (cur.innerText === player) {
			idx = curIdx;
		}
		curIdx++;
	});
	if (idx > -1) {
		switch (update) {
			case 'remove':
				playerDivs.removeChild(playerDivs.children[idx]);
				break;
			case 'replace':
				playerDivs.replaceChild(elt('li', 'Waiting...'), playerDivs.children[idx]);
		}
	}
}

var Key = {
	LEFT: 37,
	UP: 38,
	RIGHT: 39,
	DOWN: 40
};

function keyPressed(evt) {
	let keyCode = evt.keyCode || evt.which;
	let init = false;
	let changed = false;
	let p = this.players[this.localPlayer];

	if (p.direction === undefined || p.direction.length === 0) {
		init = true;
	}
	switch (keyCode) {
		case Key.LEFT:
			p.direction = [-1, 0];
			changed = true;
			break;
		case Key.UP:
			p.direction = [0, -1];
			changed = true;
			break;
		case Key.RIGHT:
			p.direction = [1, 0];
			changed = true;
			break;
		case Key.DOWN:
			p.direction = [0, 1];
			changed = true;
			break;
		default:
			break;
	}
	if (init) {
		if (p.direction.length > 0) {
			document.querySelector('#instructDiv').innerText = 'Waiting for other players...';
			this.socket.emit('playerReady', p);
		}
	}
	else if (changed) {
		this.socket.emit('directionChanged', { 'host': this.host, 'player': p.player, 'direction': p.direction });
	}
	if([37, 38, 39, 40].indexOf(evt.keyCode) > -1) {
        evt.preventDefault();
    }
}

function highScoresBtnClick(evt) {
	let highScoresTable = document.querySelector('#highScores');
	while (highScoresTable.hasChildNodes()) {
		highScoresTable.removeChild(highScoresTable.lastChild);
	}
	const req = new XMLHttpRequest();
	const url = '/tron/highScores';

	req.open('GET', url);

	req.addEventListener('load', function(evt) {
		if (req.status >= 200 && req.status < 300) {
			highScoresTable.appendChild(elt('tr', elt('th', ''), elt('th', ''), elt('th', 'Player'), elt('th', 'Wins'), elt('th', 'Losses'), elt('th', 'Win/Loss')));
			const players = JSON.parse(req.responseText);
			let count = 1;
			players.forEach((p) => {
				const imgElem = document.createElement('img');
				imgElem.className = 'profileIcon';
				imgElem.src = p.profile;
				highScoresTable.appendChild(elt('tr', elt('td', '' + count), elt('td', imgElem), elt('td', p.player), elt('td', '' + p.win), elt('td', '' + p.lose), elt('td', '' + p.winLoss) ));
				count++;
			});
		}
	});

	req.send();

	changeView('highScores');
}

function mainViewBtnClick(evt) {
	changeView('main');
}

function leaveGameBtnClick(evt) {
	this.socket.emit('leaveGame', this.players[this.localPlayer]);
}

function initGame(gameInfo) {
	gameCanvas = new Game(socket, gameInfo, 650, 650);
	let winnerDiv = document.querySelector('#winnerDiv');
	if (winnerDiv) {
		document.querySelector('.game').removeChild(winnerDiv);
	}
	const instructDiv = document.querySelector('#instructDiv');
	instructDiv.style.display = 'inline-block';
	instructDiv.innerText = 'Press an arrow key to begin.';
	document.querySelector('#leaveGameBtn').disabled = true;
	if (keydownListener) {
		document.removeEventListener('keydown', keydownListener);
	}
	keydownListener = keyPressed.bind(gameCanvas);
	document.addEventListener('keydown', keydownListener);
	if (leaveGameListener) {
		document.querySelector('#leaveGameBtn').removeEventListener('click', leaveGameListener);	
	}
	leaveGameListener = leaveGameBtnClick.bind(gameCanvas);
	document.querySelector('#leaveGameBtn').addEventListener('click', leaveGameListener);
}

function playerLeaveGame(playerInfo) {
	const gameDiv = document.querySelector(`#${playerInfo.host}`);
	if (playerInfo.player === playerInfo.host) {
		delete lobby.games[playerInfo.host];
		if (lobby.localGame === playerInfo.host) {
			lobby.localGame = undefined;
			changeView('main');
		}
		document.querySelector('#gameCol').removeChild(gameDiv);
	}
	else {
		lobby.games[playerInfo.host].players.splice(lobby.games[playerInfo.host].players.indexOf(playerInfo.player), 1);
		if (lobby.localGame === playerInfo.host) {
			updateChildDiv('remove', '#playerScores', playerInfo.player);
		}
		if (lobby.viewHost === playerInfo.host) {
			updateChildDiv('replace', '#players', playerInfo.player);
		}
	}
	if (lobby.localUser === playerInfo.player) {
		lobby.localGame = undefined;
		changeView('main');
	}
}

function createGameClick(evt) {
	tronGame = { 'host': socket.user, 'players': [socket.user] };
	lobby.localGame = tronGame.host;
	lobby.addGame(tronGame);
	lobby.showGameInfoView(tronGame.host, [...tronGame.players]);
	socket.emit('createGame', tronGame);
};

function main() {
	var userName = document.querySelector('#userName').text;
	socket = io('', { query: `user=${userName}` });
	socket.user = userName;
	lobby = new Lobby(socket);

	socket.on('addUser', function(user) {
		lobby.addUser(user);
	});

	socket.on('userDisconnect', function(user) {
		let isSynced = true;
		let idx = lobby.users.indexOf(user);
		if (idx > -1) {
			lobby.users.splice(idx, 1);
			isSynced = false;
		}
		for (let host in lobby.games) {
			let cur = lobby.games[host].players;
			if (cur.includes(user)) {
				playerLeaveGame({ 'host': host, 'player': user });
				isSynced = false;
				break;
			}
		}
		if (!isSynced) {
			lobby.updateElements();
		}
	});

	/*
		Used to sync lobby state with newly added user
	*/
	socket.on('syncLobby', function(user, game, profile) {
		let isSynced = true;
		if (!lobby.users.includes(user)) {
			lobby.users.push(user);
			isSynced = false;
		}
		if (game) {
			if (!lobby.games.hasOwnProperty(game)) {
				lobby.addGame({ 'host': game, 'players': [game] });
				isSynced = false;
			}
			if (game !== user && !lobby.games[game].players.includes(user)) {
				lobby.games[game].players.push(user);
				isSynced = false;
			}
		}
		lobby.profiles[user] = profile;
		if (!isSynced) {
			lobby.updateElements();
		}
	});

	socket.on('joinGame', function(userInfo) {
		lobby.games[userInfo.host].players.push(userInfo.player);

		if (lobby.view === 'gameInfoView' && lobby.viewHost === userInfo.host) {
			const pDiv = document.querySelector('#players');
			pDiv.replaceChild(elt('li', userInfo.player), pDiv.children[userInfo.idx]);
		}
	});

	socket.on('leaveGame', function(playerInfo) {
		playerLeaveGame(playerInfo);
	});

	socket.on('addGame', function(game) {
		lobby.addGame(game);
	});

	socket.on('startGame', function(gameInfo) {
		changeView('game');
		let playerScoreList = document.querySelector('#playerScores');
		while (playerScoreList.hasChildNodes()) {
			playerScoreList.removeChild(playerScoreList.lastChild);
		}
		for (let p in gameInfo.initPositions) {
			const cur = gameInfo.initPositions[p];
			const scoreDiv = elt('div', '' + cur.score);
			scoreDiv.id = `${cur.player}ScoreDiv`;
			const imgElem = document.createElement('img');
			imgElem.className = 'profileIcon';
			imgElem.src = lobby.profiles[cur.player];
			const liEl = elt('li', elt('h3', `${cur.player}: `, scoreDiv, imgElem));
			liEl.style.color = cur.color;
			playerScoreList.appendChild(liEl);
		}
		initGame(gameInfo.initPositions);
	});

	socket.on('restartGame', function(gameInfo) {
		let ctx = gameCanvas.canvas.getContext('2d');
		ctx.clearRect(0, 0, gameCanvas.w, gameCanvas.h);
		initGame(gameInfo);
	});

	socket.on('playerReady', function(playerInfo) {
		gameCanvas.players[playerInfo.player] = playerInfo;
		let count = 0;
		for (let p in gameCanvas.players) {
			let cur = gameCanvas.players[p];
			if (cur.direction !== undefined && cur.direction.length !== 0) {
				count++;
			}
		}
		if (count === Object.keys(gameCanvas.players).length) {
			document.querySelector('#instructDiv').style.display = 'none';
			gameCanvas.ready = true;
		}
	});

	socket.on('receiveData', function(directions) {
		for (let player in directions) {
			if (gameCanvas.players[player].live) {
				gameCanvas.updatePosition(player, directions[player]);
			}
		}
		gameCanvas.getCollisions();
		gameCanvas.getWinner();
		gameCanvas.timer++;
	});

	document.querySelector('#createGame').addEventListener('click', createGameClick);
	document.querySelector('#highScoresBtn').addEventListener('click', highScoresBtnClick);
	document.querySelectorAll('#mainViewBtn').forEach(function(cur) {
		cur.addEventListener('click', mainViewBtnClick);
	});
};

document.addEventListener('DOMContentLoaded', main);