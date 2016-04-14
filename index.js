var ExpressApp = require("express");
var fs = require("fs");
var app = ExpressApp();
var mysql = require("mysql");
var urlenc = require("body-parser").urlencoded({extended: false});
var bcrypt = require("bcrypt");
var pool = mysql.createPool({
	connectionLimit: 50,
	debug: false,
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME
});

Object.size = function(obj) {
	var size = 0, key;
	for (key in obj) {
			if (obj.hasOwnProperty(key)) size++;
	}
	return size;
};

app.use(ExpressApp.static("static"));

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

function handleConnection(q, rsp) {
	pool.getConnection(function(err, conn) {
		if (err) {
			console.log("Error happened\n", err);
			conn.release();
			rsp.end();
			return;
		}
		
		console.log("Connected successfully");
		
		conn.query(q, function(err, rows) {
			conn.release();
			if (!err) {
				rsp.end(JSON.stringify(rows));
				return;
			}
			rsp.end();
		});
	});
}

app.get("/g/countries", function(req, resp) {
	handleConnection("SELECT * FROM l_countries", resp);
});

app.get("/g/leagues", function(req, resp) {
	var q = "SELECT * FROM  l_leagues";
	console.log(Object.size(req.query));
	if (Object.size(req.query) >= 1) {
		q += " WHERE ";
		if (req.query.c_id) q += "c_id=" + req.query.c_id + " ";
	}
	console.log(q);
	handleConnection(q, resp);
});

app.get("/", function(req, rsp) {
	rsp.sendFile(__dirname + "/static/index.html", function(err) {
		if (err) console.log(err);
		rsp.end();
	});
});

app.listen(process.env.PORT || 5000, function() {
	console.log("Listening to port 5000");
});
	
/*
fs.readFile("db.txt", "utf8", function(err, data) {
	var conf = {connectionLimit: 50, debug: false};
	if (err) return console.log(err);
	var file = data.split("\r\n");
	for (var line in file) {
		conf[file[line].split("=")[0]] = file[line].split("=")[1];
	}
	
	pool = mysql.createPool(conf);
	
	app.listen(process.env.PORT || 5000, function() {
		console.log("Listening to port 5000");
	});
	
});
*/