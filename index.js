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
//@param cols: An array of all the wanted columns, separated by commas. Not required.
function SQLSelect(table, where, cols) {
	this.table = table;
	this.cols = cols || "*";
	this.where = where || "";
	this.generate = function() {
		var q = "SELECT " + this.cols.toString() + " FROM " + this.table;
		if (this.where.length > 0) {
			q += " WHERE " + this.where.toString();
		}
		return q;
	}
}

//@param table: Name of the table in which to insert the data
//@param values: Values that will be inserted in an array or matrix, in the same order the columns are.
//@param cols: Array of all the columns in the right order.
function SQLInsert(table, values, cols) {
	this.table = table;
	this.cols = cols || "";
	this.values = values;
	this.generate = function() {
		var q = "INSERT INTO " + this.table + " (" + this.cols.toString() + ") VALUES ";
		var manyrows = (typeof this.values[0]) == "object";
		if (!manyrows) this.values = [this.values];
		for (var a=0; a<this.values.length; a++) {
			q += "(";
			for (var b=0; b<this.values[a].length; b++) {
				if (typeof this.values[a][b] === "string") q += "'"+this.values[a][b]+"'";
				else q += this.values[a][b];
				if (this.values[a].length !== b + 1) q += ",";
			}
			q += ")";
			if (this.values.length !== a + 1) q += ",";
		}
		return q;
	}
}

//@param table: Name of the table in which to insert the data
//@param cols: Columns to which assign the new value and the value
//@param where: Array of query conditions
function SQLUpdate(table, assigns, where) {
	this.table = table;
	this.assigns = assigns;
	this.where = where;
	this.generate = function() {
		var q = "UPDATE "+this.table+" SET "+this.assigns.toString();
		q += " WHERE " + this.where.join(" AND ");
		return q;
	}
}

//@param table: Name of the table in which to insert the data
//@param cols: Columns to which assign the new value and the value
//@param where: Array of query conditions
function SQLDelete(table, where) {
	this.table = table;
	this.where = where;
	this.generate = function() {
		var q = "DELETE FROM " + this.table + " WHERE " + this.where.join(" AND ");
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
			rsp.end();
			return;
		}
		//conn.release();
		console.log("Connected successfully");		
		cb(conn);
	});
}

function queryResponse(q, rsp) {
	getConnection(function(conn) {
		conn.query(q, function(err, rows) {
			if (err) {
				console.log(err);
				rsp.end();
				return;
			}
			conn.release();
			rsp.end(JSON.stringify(rows));
		});
	});
}

function getDataFromDB(q, cb) {
	getConnection(function(conn) {
		conn.query(q, function(err, rows) {
			if (err) {
				console.log(err);
				return;
			}
			conn.release();
			cb(rows);
		});
	});
}

function updateDB(q, cb) {
	getConnection(function(conn) {
		conn.query(q, function(err) {
			if (err) {
				console.log(err);
				return;
			}
			conn.release();
			cb(err);
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
	var q = new SQLSelect("l_teams");
	var validParam = false;
	if (Object.size(req.query) >= 1) {
		//Parse params
	}
	queryResponse(q.generate(), rsp);
});

app.get("/g/users", function(req, rsp) {
	var params = [];
	if (Object.size(req.query) >= 1) {
		if (req.query.id) {
			params.push("u_id="+req.query.id);
		}
		if (req.query.token) {
			params.push("u_token='"+req.query.token+"'");
		}
	}
	var q = new SQLSelect("l_users", params, ["u_name", "u_pic"]);
	queryResponse(q.generate(), rsp);
});

app.get("/g/seasons", function(req, rsp) {
	var params = [];
	if (Object.size(req.query) >= 1) {
		if (req.query.s_id) {
			params.push("s_id="+req.query.s_id);
		}
		if (req.query.s_league) {
			params.push("s_league="+req.query.s_league);
		}
		if (req.query.s_year) {
			params.push("s_year="+req.query.s_year);
		}
	}
	var q = new SQLSelect("l_seasons", params);
	queryResponse(q.generate(), rsp);
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
			if (err) {
				rsp.end(JSON.stringify({
					login: false,
					token: null,
					msg: "Password or username incorrect"
				}));
				return;
			}
			var token = genToken();
			if (m) {
				var q = new SQLUpdate("l_users", ["u_token='"+token+"'", "u_lastlogin=NOW()"], ["u_name='"+u+"'"]);
				updateDB(q.generate(), function(err) {
					if (!err) {
						rsp.end(JSON.stringify({
							login: true,
							token: token,
							msg: "Login was successful"
						}));
					} else {
						rsp.end(JSON.stringify({
							login: false,
							token: null,
							msg: "An error occurred"
						}));
					}
				});
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
	var q = new SQLSelect("l_users", ["u_token='"+token+"'"], ["TIMESTAMPDIFF(MINUTE, u_lastlogin, NOW()) AS mins", "u_id"]);
	getDataFromDB(q.generate(), function(rows) {
		if (rows.length === 0) {
			rsp.end(JSON.stringify({
				login: false,
				msg: "No user was found with that token"
			}));
		} else if (rows[0].mins >= 60) {
			var q = new SQLUpdate("l_users", ["u_token=NULL"], ["u_id="+rows[0].u_id]);
			updateDB("UPDATE l_users SET u_token=NULL WHERE u_id="+rows[0].u_id, function(err) {
				rsp.end(JSON.stringify({
					login:false, 
					msg: "Your session has expired"
				}));
			});
		} else {
			var q = new SQLUpdate("l_users", ["u_lastlogin=NOW()"], ["u_id="+rows[0].u_id]);
			updateDB(q.generate(), function(err) {
				if (!err) {
					rsp.end(JSON.stringify({
						login: true,
						msg: "No problem"
					}));
				} else {
					rsp.end(JSON.stringify({
						login: false,
						msg: err.error
					}));
				}
			});
		}
	});
});

app.post("/p/logout", urlenc, function(req, rsp) {
	var token = req.body.token;
	var q = new SQLSelect("l_users", ["u_token='"+token+"'"]);
	getDataFromDB(q.generate(), function(rows) {
		if (rows.length === 0) {
			rsp.end(JSON.stringify({
				error: true,
				msg: "No user was found with that token"
			}));
			return;
		}
		var id = rows[0].u_id;
		var q = new SQLUpdate("l_users", ["u_token=NULL"], ["u_id="+id]);
		updateDB(q.generate(), function(err) {
			if (!err) {
				rsp.end(JSON.stringify({
					error: false,
					msg: "Logged out successfully"
				}));
			} else {
				rsp.end(JSON.stringify({
					error: true,
					msg: err.error
				}));
			}
		});
	});
});

app.post("/p/pass_ch", urlenc, function(req, rsp) {
	var token = req.body.token;
	var old_pass = req.body.old_pass;
	var new_pass = req.body.new_pass;
	var q = new SQLSelect("l_users", ["u_token='"+token+"'"]);
	getDataFromDB(q.generate(), function(rows) {
		if (rows.length === 0) {
			rsp.end(JSON.stringify({
				error: true,
				msg: "No user was found with that token"
			}));
			return;
		}
		var hpass = rows[0].u_password;
		bcrypt.compare(old_pass, hpass, function(err, m) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: err.error
				}));
			}
			if (!m) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "Incorrect password"
				}));
				return;
			}
			bcrypt.genSalt(10, function(err, salt) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: err.error
					}));
					return;
				}
				bcrypt.hash(new_pass, salt, function(err, hash) {
					if (err) {
						rsp.end(JSON.stringify({
							error: true,
							msg: err.error
						}));
						return;
					}
					var q = new SQLUpdate("l_users", ["u_password='"+hash+"'"], ["u_token='"+token+"'"]);
					updateDB(q.generate(), function(err) {
						if (!err) {
							rsp.end(JSON.stringify({
								error: false,
								msg: "Password changed successfully"
							}));
						} else {
							rsp.end(JSON.stringify({
								error: true,
								msg: err.error
							}));
						}
					});
				})
			});
		});
	});
});

app.post("/p/register", urlenc, function(req, rsp) {
	var n = req.body.username;
	var p = req.body.password;
	bcrypt.genSalt(10, function(err, salt) {
		if (err) {
			rsp.end(JSON.stringify({
				error: true,
				msg: err.error
			}));
			return;
		}
		bcrypt.hash(p, salt, function(err, hash) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: err.error
				}));
				return;
			}
			var q = new SQLInsert("l_users", [n, hash], ["u_name", "u_password"]);
			updateDB(q.generate(), function(err) {
				console.log(err);
				if (!err) {
					rsp.end(JSON.stringify({
						error: false,
						msg: "User created successfully"
					}));
				} else {
					rsp.end(JSON.stringify({
						error:true,
						msg: err
					}));
				}
			});
		});
	});
});

app.post("/p/ch_country", urlenc, function(req, rsp) {
	var id = req.body.c_id;
	if (id === undefined) {
		var cols = [];
		var values = [];
		if (Object.size(req.body) >= 1) {
			if (req.body.c_name) {
				cols.push("c_name");
				values.push(req.body.c_name);
			}
			if (req.body.c_flag) {
				cols.push("c_flag");
				values.push(req.body.c_flag);
			}
			var q = new SQLInsert("l_countries", values, cols);
			updateDB(q.generate(), function(err) {
				if (!err) {
					rsp.end(JSON.stringify({
						error: false,
						msg: "New country created correctly"
					}));
				} else {
					rsp.end(JSON.stringify({
						error: true,
						msg: err.error
					}));
				}
			});
		} else {
			rsp.end(JSON.stringify({
				error: true,
				msg: "Not enough information to create a country instance"
			}));
		}
	} else {
		var asgs = [];
		if (req.body.c_name) {
			asgs.push("c_name='"+req.body.c_name+"'");
		}
		if (req.body.c_flag) {
			asgs.push("c_flag='"+req.body.c_flag+"'");
		}
		var q = new SQLUpdate("l_countries", asgs, ["c_id="+id]);
		updateDB(q.generate(), function(err) {
			if (!err) {
				rsp.end(JSON.stringify({
					error: false,
					msg: "Country updated successfully"
				}));
			} else {
				rsp.end(JSON.stringify({
					error: true,
					msg: err.error
				}));
			}
		});
	}
});

app.post("/p/del_country", urlenc, function(req, rsp) {
	var id = req.body.c_id;
	if (id !== undefined) {
		var q = new SQLDelete("l_countries", ["c_id="+id]);
		updateDB(q.generate(), function(err) {
			if (!err) {
				rsp.end(JSON.stringify({
					error: false,
					msg: "Country deleted successfully"
				}));
			} else {
				rsp.end(JSON.stringify({
					error: true,
					msg: err.error
				}));
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "The country's ID is required"
		}));
	}
});

app.post("/p/ch_league", urlenc, function(req, rsp) {
	var id = req.body.l_id;
	if (id === undefined) {
		var cols = [];
		var values = [];
		if (Object.size(req.body) >= 1) {
			if (req.body.l_name) {
				cols.push("l_name");
				values.push(req.body.l_name);
			}
			if (req.body.l_logo) {
				cols.push("l_logo");
				values.push(req.body.l_logo);
			}
			if (req.body.l_country) {
				cols.push("l_country");
				values.push(req.body.l_country);
			}
			var q = new SQLInsert("l_leagues", values, cols);
			updateDB(q.generate(), function(err) {
				if (!err) {
					rsp.end(JSON.stringify({
						error: false,
						msg: "New league created correctly"
					}));
				} else {
					rsp.end(JSON.stringify({
						error: true,
						msg: err.error
					}));
				}
			});
		} else {
			rsp.end(JSON.stringify({
				error: true,
				msg: "Not enough information to create a league instance"
			}));
		}
	} else {
		var asgs = [];
		if (req.body.l_name) {
			asgs.push("l_name='"+req.body.l_name+"'");
		}
		if (req.body.l_logo) {
			asgs.push("l_logo='"+req.body.l_logo+"'");
		}
		if (req.body.l_country) {
			asgs.push("l_country="+req.body.l_country);
		}
		var q = new SQLUpdate("l_leagues", asgs, ["l_id="+id]);
		updateDB(q.generate(), function(err) {
			if (!err) {
				rsp.end(JSON.stringify({
					error: false,
					msg: "League updated successfully"
				}));
			} else {
				rsp.end(JSON.stringify({
					error: true,
					msg: err.error
				}));
			}
		});
	}
});

app.post("/p/del_league", urlenc, function(req, rsp) {
	var id = req.body.l_id;
	if (id !== undefined) {
		var q = new SQLDelete("l_leagues", ["l_id="+id]);
		updateDB(q.generate(), function(err) {
			if (!err) {
				rsp.end(JSON.stringify({
					error: false,
					msg: "League deleted successfully"
				}));
			} else {
				rsp.end(JSON.stringify({
					error: true,
					msg: err.error
				}));
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "The league's ID is required"
		}));
	}
});

app.post("/p/ch_season", urlenc, function(req, rsp) {
	var id = req.body.s_id;
	if (id === undefined) {
		var cols = [];
		var values = [];
		if (Object.size(req.body) >= 1) {
			if (req.body.s_desc) {
				cols.push("s_desc");
				values.push(req.body.s_desc);
			}
			if (req.body.s_year) {
				cols.push("s_year");
				values.push(parseInt(req.body.s_year));
			}
			if (req.body.s_league) {
				cols.push("s_league");
				values.push(parseInt(req.body.s_league));
			}
			var q = new SQLInsert("l_seasons", values, cols);
			updateDB(q.generate(), function(err) {
				if (!err) {
					rsp.end(JSON.stringify({
						error: false,
						msg: "New season created correctly"
					}));
				} else {
					rsp.end(JSON.stringify({
						error: true,
						msg: err.error
					}));
				}
			});
		} else {
			rsp.end(JSON.stringify({
				error: true,
				msg: "Not enough information to create a season instance"
			}));
		}
	} else {
		var asgs = [];
		if (req.body.s_desc) {
			asgs.push("s_desc='"+req.body.s_desc+"'");
		}
		if (req.body.s_year) {
			asgs.push("s_year="+req.body.s_year);
		}
		var q = new SQLUpdate("l_seasons", asgs, ["s_id="+id]);
		updateDB(q.generate(), function(err) {
			if (!err) {
				rsp.end(JSON.stringify({
					error: false,
					msg: "Season updated successfully"
				}));
			} else {
				rsp.end(JSON.stringify({
					error: true,
					msg: err
				}));
			}
		});
	}
});

app.post("/p/del_season", urlenc, function(req, rsp) {
	var id = req.body.s_id;
	if (id !== undefined) {
		var q = new SQLDelete("l_seasons", ["s_id="+id]);
		updateDB(q.generate(), function(err) {
			if (!err) {
				rsp.end(JSON.stringify({
					error: false,
					msg: "Season deleted successfully"
				}));
			} else {
				rsp.end(JSON.stringify({
					error: true,
					msg: err.error
				}));
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "The season's ID is required"
		}));
	}
});

app.listen(process.env.PORT || 5000, function() {
	console.log("Listening to port 5000");
});