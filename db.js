const mongoose = require('mongoose');
const URLSlugs = require('mongoose-url-slugs');
const passportLocalMongoose = require('passport-local-mongoose');

const User = new mongoose.Schema({ });
User.plugin(passportLocalMongoose);

const UserInfo = new mongoose.Schema({
	user: String,
	win: Number,
	lose: Number,
	profile: String
});

mongoose.model('User', User);
mongoose.model('UserInfo', UserInfo);

let dbconf;
if (process.env.NODE_ENV === 'PRODUCTION') {
	const fs = require('fs'),
		path = require('path'),
		fn = path.join(__dirname, 'config.json'),
		data = fs.readFileSync(fn);

	const conf = JSON.parse(data);
	dbconf = conf.dbconf;
}
else {
	dbconf = 'mongodb://localhost/tron';
}

mongoose.connect(dbconf);