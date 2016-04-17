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

//Express configuring

app.use(ExpressApp.static("static"));

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.header("Content-Type", "application/json; charset=utf-8");
	next();
});

//Custom class definition

//@param table: Name of the table from which query data. REQUIRED!
//@param where: Array of strings with all the conditions that are to meet. Not required.
//@param cols: A string of all the wanted columns, separated by commas. Not required.
function SQLSelect(table, where, cols) {
	this.table = table;
	this.cols = cols || "*";
	this.where = where || "";
	this.generate = function() {
		var q = "SELECT " + this.cols + " FROM " + this.table;
		if (this.where.length > 0) {
			q += " WHERE " + this.where.toString();
		}
		return q;
	}
}

//Function definitions and implementations
Object.size = function(obj) {
	var size = 0, key;
	for (key in obj) {
			if (obj.hasOwnProperty(key)) size++;
	}
	return size;
};

function genToken() {
	var letters = "abcdefghiklmnopqrstuvwwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
	var token = "";
	for (var i = 0 ; i < 36 ; ++i) {
		token += letters[Math.floor(Math.random() * letters.length)];
	}
	return token;
}

function getConnection(cb) {
	pool.getConnection(function(err, conn) {
		if (err) {
			console.log("Error happened\n", err);
			conn.release();
			rsp.end();
			return;
		}		
		console.log("Connected successfully");		
		cb(conn);
	});
}

function queryResponse(q, rsp) {
	getConnection(function(conn) {
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

function getDataFromDB(q, cb) {
	getConnection(function(conn) {
		conn.query(q, function(err, rows) {
			conn.release();
			if (!err) {
				cb(rows);
			} else console.log(err);
		});
	});
}

function updateDB(q) {
	getConnection(function(conn) {
		conn.query(q, function(err) {
			conn.release();
			if (err) console.log(err);
		})
	});
}

//GET requests routing

app.get("/", function(req, rsp) {
	rsp.sendFile(__dirname + "/static/index.html", function(err) {
		if (err) console.log(err);
		rsp.end();
	});
});

app.get("/g/countries", function(req, resp) {
	var params = [];
	if (Object.size(req.query) >= 1) {
		if (req.query.name) {
			params.push("c_name LIKE '%" + req.query.name + "%'");
		}
	}
	var q = new SQLSelect("l_countries", params);
	queryResponse(q.generate(), resp);
});

app.get("/g/leagues", function(req, resp) {
	var params = [];
	if (Object.size(req.query) >= 1) {
		if (req.query.l_country) {
			params.push("l_country=" + req.query.l_country);
		}
	}
	var q = new SQLSelect("l_leagues", params);
	queryResponse(q.generate(), resp);
});

app.get("/g/teams", function(req, rsp) {
	var q = "SELECT * FROM l_teams";
	var validParam = false;
	if (Object.size(req.query) >= 1) {
		//Parse params
	}
	queryResponse(q, rsp);
});

//POST request routing

app.post("/p/login", urlenc, function(req, rsp) {
	var u = req.body.username;
	var p = req.body.password;
	if (u === undefined || p === undefined) {
		rsp.end(JSON.stringify({
			login: false,
			token: null,
			msg: "Password or username missing in the request"
		}));
		return;
	}
	var q = new SQLSelect("l_users", ["u_name='"+u+"'"]);
	getDataFromDB(q.generate(), function(rows) {
		if (rows.length === 0) {
			rsp.end(JSON.stringify({
				login: false,
				token: null,
				msg: "Password or username incorrect"
			}));
			return;
		}
		bcrypt.compare(p, rows[0].u_password, function(err, m) {
			if (err) return console.log("An error occurred\n", err);
			var q = new SQLSelect("l_users", ["u_name='"+u+"'"]);
			var token = genToken();
			if (m) {
				rsp.end(JSON.stringify({
					login: true,
					token: token,
					msg: "Login was successful"
				}));
				updateDB("UPDATE l_users SET u_token='"+token+"', u_lastlogin=NOW() WHERE u_name='"+u+"'");
			} else {
				rsp.end(JSON.stringify({
					login: false,
					token: null,
					msg: "Password or username incorrect"
				}));
			}
		});
	});
});

app.post("/p/check_user", urlenc, function(req, rsp) {
	var token = req.body.token;
	var q = new SQLSelect("l_users", ["u_token='"+token+"'"], "TIMESTAMPDIFF(MINUTE, u_lastlogin, NOW()) AS mins, u_id");
	getDataFromDB(q.generate(), function(rows) {
		if (rows.length === 0) {
			rsp.end(JSON.stringify({
				login: false,
				msg: "No user was found with that token"
			}));
		} else if (rows[0].mins >= 60) {
			rsp.end(JSON.stringify({
				login:false, 
				msg: "Your session has expired"
			}));
			updateDB("UPDATE l_users SET u_token=NULL WHERE u_id="+rows[0].u_id);
		} else {
			rsp.end(JSON.stringify({
				login: true,
				msg: "No problem"
			}));
			updateDB("UPDATE l_users SET u_lastlogin=NOW() WHERE u_id="+rows[0].u_id);
		}
	});
});

app.listen(process.env.PORT || 5000, function() {
	console.log("Listening to port 5000");
});