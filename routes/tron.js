const express = require('express'),
	router = express.Router(),
	passport = require('passport'),
	mongoose = require('mongoose'),
	UserInfo = mongoose.model('UserInfo');


/* GET users listing. */
router.get('/', function(req, res, next) {
	let profilePic = '';
	UserInfo.findOne({'user': req.user.username}, (err, userInfo) => {
		if (userInfo) {
			profilePic = userInfo.profile;
		}
		res.render('tron', { 'profilePic': profilePic });
	});
});

router.get('/highScores', (req, res, next) => {
	UserInfo.find({}, (err, users) => {
		let userList = users.map((cur) => {
			return { 'player': cur.user, 'win': cur.win, 'lose': cur.lose, 'winLoss': cur.win / Math.max(cur.lose, 1), 'profile': cur.profile };
		});
		userList.sort((a, b) => {
			if (Math.abs(a.winLoss - b.winLoss) <= 1e-9) {
				return (a.win === b.win) ? (a.lose - b.lose) : (b.win - a.win);
			}
			else {
				return b.winLoss - a.winLoss;
			}
		});
		res.json(userList);
	});
});

module.exports = router;