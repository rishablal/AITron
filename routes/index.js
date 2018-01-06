const express = require('express'),
	router = express.Router(),
	passport = require('passport'),
	mongoose = require('mongoose'),
	User = mongoose.model('User');
	UserInfo = mongoose.model('UserInfo');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.get('/signIn', (req, res, next) => {
	res.render('signIn');
});

router.post('/signIn', (req, res, next) => {
	passport.authenticate('local', (err, user) => {
		req.session.err = err;
		if (user) {
			req.logIn(user, (err) => {
				res.redirect('/tron');
			});
		}
		else {
			res.redirect('/signIn');
		}
	})(req, res, next);
});

router.get('/signOut', (req, res, next) => {
	req.logout();
	res.redirect('/');
});

router.get('/register', (req, res, next) => {
	res.render('register', {'err': req.session.err});
});

router.post('/register', (req, res, next) => {
	User.register(new User({username: req.body.username}), req.body.password, (err, user) => {
			req.session.err = err;
			if (err) {
				res.redirect('/register');
			}
			else {
				passport.authenticate('local')(req, res, function() {
					new UserInfo({
						user: user.username,
						win: 0, 
						lose: 0, 
						profile:'/images/profile.png'
					}).save((err, userInfo, count) => {
						if (err) {
							console.log(err);
						}
						else {
							res.redirect('/tron');
						}
					});
				});
			}
		});
});

router.get('/about', (req, res, next) => {
	res.render('about');
});

module.exports = router;
