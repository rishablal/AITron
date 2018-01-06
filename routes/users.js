const express = require('express'),
	router = express.Router(),
	mongoose = require('mongoose'),
	UserInfo = mongoose.model('UserInfo');


/* GET users listing. */

router.get('/:username', (req, res, next) => {
	UserInfo.findOne({'user': req.params.username}, (err, userInfo) => {
		res.render('profile', {'userInfo': userInfo, 'self': req.user.username === req.params.username, 'profilePic': userInfo.profile});
	});
});

router.post('/:username', (req, res, next) => {
	UserInfo.findOne({'user': req.params.username}, (err, userInfo) => {
		userInfo.profile = req.body.image || '/images/profile.png';
		userInfo.save((err, data, count) => {
			res.redirect(`${req.params.username}`);
		});
	});
});

router.post('/', (req, res, next) => {
	if (parseInt(req.body.isWinner)) {
		UserInfo.findOneAndUpdate({'user': req.body.user}, { $inc: { win: 1 } }, (err, data) => {
			if (err) {
				console.log(err);
			}
		});
	}
	else {
		UserInfo.findOneAndUpdate({'user': req.body.user}, { $inc: { lose: 1 } }, (err, data) => {
			if (err) {
				console.log(err);
			}
		});	
	}
});

module.exports = router;
