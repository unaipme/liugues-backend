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
	database: process.env.DB_NAME,
	multipleStatements: true
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
			q += " WHERE " + this.where.join(" AND ");
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
				if (typeof this.values[a][b] === "string") {
					if (this.values[a][b].endsWith("f")) q += this.values[a][b].substr(0, this.values[a][b].length - 1);
					else q += "'"+this.values[a][b]+"'";
				}
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

function parseDate(date) {
	var ret;
	ret = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
	return ret;
}

function clone(o) {
	return JSON.parse(JSON.stringify(o));
}

function getConnection(cb) {
	pool.getConnection(function(err, conn) {
		//console.log("Connected successfully");
		if (err) {
			console.log(err);
		} else {
			console.log("Connected successfully");
		}
		cb(conn, err);
	});
}

function getDataFromDB(conn, q, cb) {
	conn.query(q, function(err, rows) {
		if (err) throw err;
		cb(rows);
	});
}

function updateDB(conn, q, cb) {
	conn.query(q, function(err) {
		cb(err);
	});
}

//GET requests routing

app.get("/", function(req, rsp) {
	rsp.sendFile(__dirname + "/static/index.html", function(err) {
		if (err) console.log(err);
		rsp.end();
	});
});

app.get("/g/countries", function(req, rsp) {
	var params = [];
	if (Object.size(req.query) >= 1) {
		if (req.query.name) {
			params.push("c_name LIKE '%" + req.query.name + "%'");
		}
	}
	var q = new SQLSelect("l_countries", params);
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				error: false,
				data: "An error happened when trying to reach the database"
			}));
		} else {
			getDataFromDB(conn, q.generate(), function(rows, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						data: err
					}));
				} else {
					rsp.end(JSON.stringify({
						error: false,
						data: rows
					}));
				}
				conn.release();
			});
		}
	});
});

app.get("/g/leagues", function(req, rsp) {
	var params = [];
	if (Object.size(req.query) >= 1) {
		if (req.query.l_country) {
			params.push("l_country=" + req.query.l_country);
		}
	}
	var q = new SQLSelect("l_leagues", params);
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				error: false,
				data: "An error happened when trying to reach the database"
			}));
		} else {
			getDataFromDB(conn, q.generate(), function(rows, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						data: err
					}));
				} else {
					rsp.end(JSON.stringify({
						error: false,
						data: rows
					}));
				}
				conn.release();
			});
		}
	});
});

app.get("/g/teams", function(req, rsp) {
	var q = new SQLSelect("l_teams");
	if (Object.size(req.query) >= 1) {
		if (req.query.t_id) {
			getConnection(function(conn, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						data: "An error happened when trying to reach the database"
					}));
				} else {
					var q1 = new SQLSelect("l_team_season ts, l_seasons s", "s.s_id=ts.s_id AND ts.t_id="+req.query.t_id, "s.*");
					getDataFromDB(conn, q1.generate(), function(rows, err) {
						if (err) {
							rsp.end(JSON.stringify({
								error: true,
								data: err
							}));
							conn.release();
						} else {
							var q2 = new SQLSelect("l_teams", "t_id="+req.query.t_id);
							getDataFromDB(conn, q2.generate(), function(rows2, err2) {
								if (err2) {
									rsp.end(JSON.stringify({
										error: true,
										data: err2
									}));
								} else {
									var r = rows2[0];
									r.seasons = rows;
									rsp.end(JSON.stringify({
										error: false,
										data: r
									}));
								}
								conn.release();
							});
						}
					});
				}
			});
		}
	} else {
		var q = new SQLSelect("l_teams");
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					data: "An error happened when trying to reach the database"
				}));
			} else {
				getDataFromDB(conn, q.generate(), function(rows, err) {
					if (err) {
						rsp.end(JSON.stringify({
							error: true,
							data: err
						}));
					} else {
						rsp.end(JSON.stringify({
							error: false,
							data: rows
						}));
					}
					conn.release();
				});
			}
		});
	}
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
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				error: true,
				data: "An error happened when trying to reach the database"
			}));
		} else {
			var q = new SQLSelect("l_users", params, ["u_name", "u_pic"]);
			getDataFromDB(conn, q.generate(), function(rows, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						data: err
					}));
				} else {
					rsp.end(JSON.stringify({
						error: false,
						data: rows
					}));
				}
				conn.release();
			});
		}
	});
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
	params.push("l.l_id=s.s_league");
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				error: true,
				data: "An error happened when trying to reach the database"
			}));
		} else {
			var q = new SQLSelect("l_seasons s, l_leagues l", params, "s.*, l.l_country");
			getDataFromDB(conn, q.generate(), function(rows, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						data: err
					}));
				} else {
					var q2 = new SQLSelect("l_teams t, l_team_season ts", ["ts.t_id=t.t_id"], "t.*, ts.s_id");
					getDataFromDB(conn, q2.generate(), function(rows2, err2) {
						if (err2) {
							rsp.end(JSON.stringify({
								error: true,
								data: err2
							}));
							conn.release();
						} else {
							for (var i=0; i<rows.length; i++) {
								var id = rows[i].s_id;
								var l = rows2.filter(function(e) {
									return (id === e.s_id);
								});
								rows[i].teams = l;
							}
							rsp.end(JSON.stringify({
								error: false,
								data: rows
							}))
						}
					});
				}
			});
		}
	});
});

app.get("/g/rounds", function(req, rsp) {
	var params = [];
	if (Object.size(req.query) >= 1) {
		if (req.query.r_id) {
			params.push("r_id="+req.query.r_id);
		}
		if (req.query.r_season) {
			params.push("r_season="+req.query.r_season);
		}
	}
	var q = new SQLSelect("v_rounds", params);
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				error: true,
				data: "An error happened when trying to reach the database"
			}));
		} else {
			getDataFromDB(conn, q.generate(), function(rows, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						data: err
					}));
				} else {
					rsp.end(JSON.stringify({
						error: false,
						data: rows
					}));
				}
				conn.release();
			});
		}
	});
});

app.get("/g/games", function(req, rsp) {
	var params = [];
	if (Object.size(req.query) >= 1) {
		if (req.query.g_round) {
			params.push("g_round="+req.query.g_round);
		}
		if (req.query.g_team) {
			params.push(g_team+" IN (g_hometeam_id, g_awayteam_id)")
		}
	}
	var q = new SQLSelect("v_games", params);
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				error: true,
				msg: "Could not reach database"
			}));
		} else {
			getDataFromDB(conn, q.generate(), function(rows, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: "An error occurred when fetching data"
					}));
				} else {
					rsp.end(JSON.stringify({
						error: false,
						data: rows
					}));
				}
				conn.release();
			});
		}
	});
});

app.get("/g/init", function(req, rsp) {
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				error: true,
				data: "Could not reach the database"
			}));
			return;
		}
		var q = new SQLSelect("l_countries");
		getDataFromDB(conn, q.generate(), function(countries, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred when fetching data"
				}));
				conn.release();
				return;
			}
			var q = new SQLSelect("v_rounds");
			getDataFromDB(conn, q.generate(), function(rounds, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						data: err
					}));
					conn.release();
					return;
				}
				var q = new SQLSelect("l_leagues");
				getDataFromDB(conn, q.generate(), function(leagues, err) {
					if (err) {
						rsp.end(JSON.stringify({
							error: true,
							data: err
						}));
						conn.release();
						return;
					}
					var q = new SQLSelect("l_teams");
					getDataFromDB(conn, q.generate(), function(teams, err) {
						if (err) {
							rsp.end(JSON.stringify({
								error: true,
								data: err
							}));
							conn.release();
							return;
						}
						var q = new SQLSelect("v_games");
						getDataFromDB(conn, q.generate(), function(games, err) {
							if (err) {
								rsp.end(JSON.stringify({
									error: true,
									data: err
								}));
								conn.release();
								return;
							}
							var q = new SQLSelect("l_seasons");
							getDataFromDB(conn, q.generate(), function(seasons, err) {
								if (err) {
									rsp.end(JSON.stringify({
										error: true,
										data: err
									}));
									conn.release();
									return;
								}
								var q = new SQLSelect("l_team_season");
								getDataFromDB(conn, q.generate(), function(ts, err) {
									if (err) {
										rsp.end(JSON.stringify({
											error: true,
											data: err
										}));
									} else {
										for (var i=0; i<ts.length; i++) {
											var e = ts[i];
											var ti, si, j;
											for (j=0; j<teams.length; j++) {
												if (teams[j].t_id === e.t_id) {
													ti = j;
													break;
												}
											}
											for (j=0; j<seasons.length; j++) {
												if (seasons[j].s_id === e.s_id) {
													si = j;
													break;
												}
											}
											var s = seasons[si];
											var t = teams[ti];
											if (!t.seasons) t.seasons = [];
											if (!s.teams) s.teams = [];
											t.seasons.push({
												s_id: s.s_id,
												s_league: s.s_league,
												s_desc: s.s_desc,
												s_year: s.s_year
											});
											seasons[si].teams.push({
												t_id: t.t_id,
												t_country: t.t_country,
												t_name: t.t_name,
												t_city: t.t_city,
												t_stadium: t.t_stadium,
												t_crest: t.t_crest
											});
										}
										var data = {
												rounds: rounds,
												countries: countries,
												leagues: leagues,
												teams: teams,
												games: games,
												seasons: seasons
										};
										rsp.end(JSON.stringify({
											error: false,
											data: data
										}));
									}
									conn.release();
								});
							});
						});
					});
				});
			});
		});
	});
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
	} else {
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					login: false,
					token: null,
					msg: "An error happened when trying to reach the database"
				}));
			} else {
				var q = new SQLSelect("l_users", ["u_name='"+u+"'"]);
				getDataFromDB(conn, q.generate(), function(rows, err) {
					if (err) {
						rsp.end(JSON.stringify({
							login: false,
							token: null,
							msg: "An error occurred"
						}));
						conn.release();
					} else {
						if (rows.length === 0) {
							rsp.end(JSON.stringify({
								login: false,
								token: null,
								msg: "Password or username incorrect"
							}));
							conn.release();
						} else {
							bcrypt.compare(p, rows[0].u_password, function(err, m) {
								if (err) {
									rsp.end(JSON.stringify({
										login: false,
										token: null,
										msg: "Password or username incorrect"
									}));
									conn.release();
								} else {
									var token = genToken();
									if (m) {
										var q = new SQLUpdate("l_users", ["u_token='"+token+"'", "u_lastlogin=NOW()"], ["u_name='"+u+"'"]);
										updateDB(conn, q.generate(), function(err) {
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
											conn.release();
										});
									} else {
										rsp.end(JSON.stringify({
											login: false,
											token: null,
											msg: "Password or username incorrect"
										}));
										conn.release();
									}
								}
							});
						}
					}
				});
			}
		});
	}
});

app.post("/p/check_user", urlenc, function(req, rsp) {
	var token = req.body.token;
	var q = new SQLSelect("l_users", ["u_token='"+token+"'"], ["TIMESTAMPDIFF(MINUTE, u_lastlogin, NOW()) AS mins", "u_id"]);
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				login: false,
				msg: "An error happened when trying to reach the database"
			}));
		} else {
			getDataFromDB(conn, q.generate(), function(rows, err) {
				if (err) {
					rsp.end(JSON.stringify({
						login: false,
						msg: "An error occurred"
					}));
					conn.release();
				} else {
					if (rows.length === 0) {
						rsp.end(JSON.stringify({
							login: false,
							msg: "No user was found with that token"
						}));
						conn.release();
					} else if (rows[0].mins >= 60) {
						var q = new SQLUpdate("l_users", ["u_token=NULL"], ["u_id="+rows[0].u_id]);
						updateDB(conn, "UPDATE l_users SET u_token=NULL WHERE u_id="+rows[0].u_id, function(err) {
							rsp.end(JSON.stringify({
								login:false, 
								msg: "Your session has expired"
							}));
							conn.release();
						});
					} else {
						var q = new SQLUpdate("l_users", ["u_lastlogin=NOW()"], ["u_id="+rows[0].u_id]);
						updateDB(conn, q.generate(), function(err) {
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
							conn.release();
						});
					}
				}
			});
		}
	});
});

app.post("/p/logout", urlenc, function(req, rsp) {
	var token = req.body.token;
	var q = new SQLSelect("l_users", ["u_token='"+token+"'"]);
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				error: true,
				msg: "An error occurred"
			}));
		} else {
			getDataFromDB(conn, q.generate(), function(rows, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: "An error occurred"
					}));
					conn.release();
				} else {
					if (rows.length === 0) {
						rsp.end(JSON.stringify({
							error: true,
							msg: "No user was found with that token"
						}));
						conn.release();
					} else {
						var id = rows[0].u_id;
						var q = new SQLUpdate("l_users", ["u_token=NULL"], ["u_id="+id]);
						updateDB(conn, q.generate(), function(err) {
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
							conn.release();
						});
					}
				}
			});
		}
	});
});

app.post("/p/pass_ch", urlenc, function(req, rsp) {
	getConnection(function(conn, err) {
		if (err) {
			rsp.end(JSON.stringify({
				error: true,
				msg: "An error occurred"
			}));
		} else {
			var token = req.body.token;
			var old_pass = req.body.old_pass;
			var new_pass = req.body.new_pass;
			var q = new SQLSelect("l_users", ["u_token='"+token+"'"]);
			getDataFromDB(conn, q.generate(), function(rows, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: "An error occurred"
					}));
					conn.release();
				} else {
					if (rows.length === 0) {
						rsp.end(JSON.stringify({
							error: true,
							msg: "No user was found with that token"
						}));
						conn.release();
					} else {
						var hpass = rows[0].u_password;
						bcrypt.compare(old_pass, hpass, function(err, m) {
							if (err) {
								rsp.end(JSON.stringify({
									error: true,
									msg: err.error
								}));
								conn.release();
							}
							if (!m) {
								rsp.end(JSON.stringify({
									error: true,
									msg: "Incorrect password"
								}));
								conn.release();
							} else {
								bcrypt.genSalt(10, function(err, salt) {
									if (err) {
										rsp.end(JSON.stringify({
											error: true,
											msg: err.error
										}));
										conn.release();
									} else {
										bcrypt.hash(new_pass, salt, function(err, hash) {
											if (err) {
												rsp.end(JSON.stringify({
													error: true,
													msg: err.error
												}));
												conn.release();
											} else {
												var q = new SQLUpdate("l_users", ["u_password='"+hash+"'"], ["u_token='"+token+"'"]);
												updateDB(conn, q.generate(), function(err) {
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
													conn.release();
												});
											}
										});
									}
								});
							}
						});
					}
				}
			});
		}
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
		} else {
			bcrypt.hash(p, salt, function(err, hash) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: err.error
					}));
				} else {
					getConnection(function(conn, err) {
						if (err) {
							rsp.end(JSON.stringify({
								error: true,
								msg: "An error occurred"
							}));
						} else {
							var q = new SQLInsert("l_users", [n, hash], ["u_name", "u_password"]);
							updateDB(conn, q.generate(), function(err) {
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
								conn.release();
							});
						}
					});
				}
			});
		}
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
			getConnection(function(conn, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: "An error occurred"
					}));
				} else {
					var q = new SQLInsert("l_countries", values, cols);
					updateDB(conn, q.generate(), function(err) {
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
						conn.release();
					});
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
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred"
				}));
			} else {
				updateDB(conn, q.generate(), function(err) {
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
					conn.release();
				});
			}
		});
	}
});

app.post("/p/del_country", urlenc, function(req, rsp) {
	var id = req.body.c_id;
	if (id !== undefined) {
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred"
				}));
			} else {
				var q = new SQLDelete("l_countries", ["c_id="+id]);
				updateDB(conn, q.generate(), function(err) {
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
					conn.release();
				});
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
			getConnection(function(conn, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: "An error occurred"
					}));
				} else {
					var q = new SQLInsert("l_leagues", values, cols);
					updateDB(conn, q.generate(), function(err) {
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
						conn.release();
					});
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
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred"
				}));
			} else {
				var q = new SQLUpdate("l_leagues", asgs, ["l_id="+id]);
				updateDB(conn, q.generate(), function(err) {
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
					conn.release();
				});
			}
		});
	}
});

app.post("/p/del_league", urlenc, function(req, rsp) {
	var id = req.body.l_id;
	if (id !== undefined) {
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred"
				}));
			} else {
				var q = new SQLDelete("l_leagues", ["l_id="+id]);
				updateDB(conn, q.generate(), function(err) {
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
					conn.release();
				});
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
			getConnection(function(conn, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: "An error occurred"
					}));
				} else {
					var q = new SQLInsert("l_seasons", values, cols);
					updateDB(conn, q.generate(), function(err) {
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
						conn.release();
					});
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
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred"
				}));
			} else {
				var q = new SQLUpdate("l_seasons", asgs, ["s_id="+id]);
				updateDB(conn, q.generate(), function(err) {
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
					conn.release();
				});
			}
		});
	}
});

app.post("/p/del_season", urlenc, function(req, rsp) {
	var id = req.body.s_id;
	if (id !== undefined) {
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred"
				}));
			} else {
				var q = new SQLDelete("l_seasons", ["s_id="+id]);
				updateDB(conn, q.generate(), function(err) {
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
					conn.release();
				});
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "The season's ID is required"
		}));
	}
});

app.post("/p/ch_team", urlenc, function(req, rsp) {
	var id = req.body.t_id;
	if (id === undefined) {
		var cols = [];
		var values = [];
		if (Object.size(req.body) >= 1) {
			if (req.body.t_name) {
				cols.push("t_name");
				values.push(req.body.t_name);
			}
			if (req.body.t_crest) {
				cols.push("t_crest");
				values.push(req.body.t_crest);
			}
			if (req.body.t_country) {
				cols.push("t_country");
				values.push(req.body.t_country);
			}
			if (req.body.t_stadium) {
				cols.push("t_stadium");
				values.push(req.body.t_stadium);
			}
			if (req.body.t_city) {
				cols.push("t_city");
				values.push(req.body.t_city);
			}
			getConnection(function(conn, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: "An error occurred"
					}));
				} else {
					var q = new SQLInsert("l_teams", values, cols);
					updateDB(conn, q.generate(), function(err) {
						if (!err) {
							rsp.end(JSON.stringify({
								error: false,
								msg: "New team created correctly"
							}));
						} else {
							rsp.end(JSON.stringify({
								error: true,
								msg: err.error
							}));
						}
						conn.release();
					});
				}
			});
		} else {
			rsp.end(JSON.stringify({
				error: true,
				msg: "Not enough information to create a team instance"
			}));
		}
	} else {
		var asgs = [];
		if (req.body.t_name)
			asgs.push("t_name='"+req.body.t_name+"'");
		if (req.body.t_crest)
			asgs.push("t_crest='"+req.body.t_crest+"'");
		if (req.body.t_country)
			asgs.push("t_country="+req.body.t_country);
		if (req.body.t_stadium)
			asgs.push("t_stadium='"+req.body.t_stadium+"'");
		if (req.body.t_city)
			asgs.push("t_city='"+req.body.t_city+"'");
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred"
				}));
			} else {
				var q = new SQLUpdate("l_teams", asgs, ["t_id="+id]);
				updateDB(conn, q.generate(), function(err) {
					if (!err) {
						rsp.end(JSON.stringify({
							error: false,
							msg: "Team updated successfully"
						}));
					} else {
						rsp.end(JSON.stringify({
							error: true,
							msg: err
						}));
					}
					conn.release();
				});
			}
		});
	}
});

app.post("/p/del_team", urlenc, function(req, rsp) {
	var id = req.body.t_id;
	if (id !== undefined) {
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred"
				}));
			} else {
				var q = new SQLDelete("l_teams", ["t_id="+id]);
				updateDB(conn, q.generate(), function(err) {
					if (!err) {
						rsp.end(JSON.stringify({
							error: false,
							msg: "Team deleted successfully"
						}));
					} else {
						rsp.end(JSON.stringify({
							error: true,
							msg: err.error
						}));
					}
					conn.release();
				});
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "The team's ID is required"
		}));
	}
});

app.post("/p/add_team_season", urlenc, function(req, rsp) {
	if (Object.size(req.body) >= 2) {
		if (req.body.s_id && req.body.t_id) {
			var values = [req.body.s_id, req.body.t_id];
			var cols = ["s_id", "t_id"];
			getConnection(function(conn, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						msg: "An error occurred"
					}));
				} else {
					var q = new SQLInsert("l_team_season", values, cols);
					updateDB(conn, q.generate(), function(err) {
						if (!err) {
							rsp.end(JSON.stringify({
								error: false,
								msg: "Team was signed up correctly"
							}));
						} else {
							rsp.end(JSON.stringify({
								error: true,
								msg: err.error
							}));
						}
						conn.release();
					});
				}
			});
		} else {
			rsp.end(JSON.stringify({
				error: true,
				msg: "Team and season IDs are required"
			}));
		}
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "Team and season IDs are required"
		}));
	}
});

app.post("/p/del_team_season", urlenc, function(req, rsp) {
	if (req.body.t_id && req.body.s_id) {
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred"
				}));
			} else {
				var q = new SQLDelete("l_team_season", ["t_id="+req.body.t_id, "s_id="+req.body.s_id]);
				updateDB(conn, q.generate(), function(err) {
					if (!err) {
						rsp.end(JSON.stringify({
							error: false,
							msg: "Team signed out successfully"
						}));
					} else {
						rsp.end(JSON.stringify({
							error: true,
							msg: err.error
						}));
					}
					conn.release();
				});
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "The team's ID is required"
		}));
	}
});

app.post("/p/fc", urlenc, function(req, rsp) {
	if (req.body.s_id && req.body.date && req.body.amount && req.body.s_desc) {
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: "An error occurred when connecting to the database"
				}));
			} else {
				var date = new Date(req.body.date);
				var last = (req.body.amount - 1) * 2;
				if (last <= 0) {
					rsp.end(JSON.stringify({
						error: true,
						msg: "Too few teams"
					}));
					conn.release();
				} else {
					var s_id = req.body.s_id;
					var s_desc = req.body.s_desc;
					var queries = [];
					for (var i=1; i<=last; i++) {
						var cols = ["r_season", "r_desc", "r_number", "r_week"];
						var values = [s_id, s_desc + ", round " + i, i, "DATE_FORMAT('"+parseDate(date)+"', '%Y-%m-%d')f"];
						var q = new SQLInsert("l_rounds", values, cols);
						queries.push(q.generate());
						date.setDate(date.getDate() + 7);
					}
					updateDB(conn, queries.join(";"), function(err) {
						if (err) {
							rsp.end(JSON.stringify({
								error: true,
								msg: "Something went wrong and the rounds could not be created"
							}));
						} else {
							rsp.end(JSON.stringify({
								error: false,
								msg: "Rounds created"
							}));
						}
						conn.release();
					});
				}
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "Some parameters are missing"
		}));
	}
});

app.post("/p/ch_round", urlenc, function(req, rsp) {
	if (req.body.r_number && req.body.r_week && req.body.r_desc && req.body.r_id) {
		var assigns = [];
		assigns.push("r_number="+req.body.r_number);
		assigns.push("r_week=DATE_FORMAT('"+req.body.r_week+"', '%Y-%m-%d')");
		assigns.push("r_desc='"+req.body.r_desc+"'");
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					data: "An error occurred when approaching the database"
				}));
			} else {
				var q = new SQLUpdate("l_rounds", assigns, ["r_id="+req.body.r_id]);
				updateDB(conn, q.generate(), function(err) {
					if (err) {
						rsp.end(JSON.stringify({
							error: true,
							data: "Could not update data"
						}));
						conn.release();
					} else {
						var q = new SQLSelect("v_rounds");
						getDataFromDB(conn, q.generate(), function(rows, err) {
							if (err) {
								rsp.end(JSON.stringify({
									error: false
								}));
							} else {
								rsp.end(JSON.stringify({
									error: false,
									data: rows
								}));
							}
							conn.release();
						});
					}
				});
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "Some parameters are missing"
		}));
	}
});

app.post("/p/del_round", urlenc, function(req, rsp) {
	if (req.body.r_id) {
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					msg: err
				}));
			} else {
				var q = new SQLDelete("l_rounds", ["r_id="+req.body.r_id]);
				updateDB(conn, q.generate(), function(err) {
					if (err) {
						rsp.end(JSON.stringify({
							error: true,
							msg: err
						}));
						conn.release();
					} else {
						var q = new SQLSelect("v_rounds");
						getDataFromDB(conn, q.generate(), function(rows, err) {
							if (err) {
								rsp.end(JSON.stringify({
									error: false
								}));
							} else {
								rsp.end(JSON.stringify({
									error: false,
									data: rows
								}));
							}
							conn.release();
						});
					}
				});
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			msg: "Some parameters are missing"
		}));
	}
});

app.post("/p/ch_game", urlenc, function(req, rsp) {
	if (req.body.g_id) {
		var as = [];
		if (req.body.g_hometeam_id) {
			as.push("g_hometeam="+req.body.g_hometeam_id);
		}
		if (req.body.g_awayteam_id) {
			as.push("g_awayteam="+req.body.g_awayteam_id);
		}
		if (req.body.g_when) {
			as.push("g_when=DATE_FORMAT('"+req.body.g_when+"', '%Y-%m-%d %H:%i')");
		}
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					data: "An error occurred when trying to approach the database"
				}));
			} else {
				var q = new SQLUpdate("l_games", as, ["g_id="+req.body.g_id]);
				updateDB(conn, q.generate(), function(err) {
					if (err) {
						rsp.end(JSON.stringify({
							error: true,
							data: "Something happened when updating the database. Is any of the teams already in a game of this round?"
						}));
						conn.release();
					} else {
						var q = new SQLSelect("v_games");
						getDataFromDB(conn, q.generate(), function(rows, err) {
							if (err) {
								rsp.end(JSON.stringify({
									error: false
								}));
							} else {
								rsp.end(JSON.stringify({
									error: false,
									data: rows
								}));
							}
							conn.release();
						});
					}
				});
			}
			
		});
	} else {
		if (Object.size(req.body) >= 2) {
			var values = [], cols = [];
			if (req.body.g_hometeam_id) {
				values.push(req.body.g_hometeam_id);
				cols.push("g_hometeam");
			}
			if (req.body.g_awayteam_id) {
				values.push(req.body.g_awayteam_id);
				cols.push("g_awayteam");
			}
			if (req.body.g_when) {
				values.push("DATE_FORMAT('"+req.body.g_when+"', '%Y-%m-%d %H:%i')f");
				cols.push("g_when");
			}
			if (req.body.g_round) {
				values.push(req.body.g_round);
				cols.push("g_round");
			}
			var q = new SQLInsert("l_games", values, cols);
			getConnection(function(conn, err) {
				if (err) {
					rsp.end(JSON.stringify({
						error: true,
						data: "An error occurred when approaching the database"
					}));
				} else {
					updateDB(conn, q.generate(), function(err) {
						if (err) {
							rsp.end(JSON.stringify({
								error: true,
								data: "Something happened when updating the database. Is any of the teams already in a game of this round?"
							}));
							conn.release();
						} else {
							var q = new SQLSelect("v_games");
							getDataFromDB(conn, q.generate(), function(rows, err) {
								if (err) {
									rsp.end(JSON.stringify({
										error: false
									}));
								} else {
									rsp.end(JSON.stringify({
										error: false,
										data: rows
									}));
								}
								conn.release();
							});
						}
					});
				}
			});
		} else {
			rsp.end(JSON.stringify({
				error: true,
				data: "More parameters are required to create a new game"
			}));
		}
	}
});

app.post("/p/del_game", urlenc, function(req, rsp) {
	if (req.body.g_id) {
		var id = req.body.g_id;
		var q = new SQLDelete("l_games", ["g_id="+id]);
		getConnection(function(conn, err) {
			if (err) {
				rsp.end(JSON.stringify({
					error: true,
					data: "An error occurred when approaching the database"
				}));
			} else {
				updateDB(conn, q.generate(), function(err) {
					if (err) {
						rsp.end(JSON.stringify({
							error: true,
							data: "An error occurred when trying to delete the game"
						}));
					} else {
						rsp.end(JSON.stringify({
							error: false,
							data: "Game deleted successfully"
						}));
					}
					conn.release();
				});
			}
		});
	} else {
		rsp.end(JSON.stringify({
			error: true,
			data: "The ID of the game is required"
		}));
	}
});

app.listen(process.env.PORT || 5000, function() {
	console.log("Listening to port 5000");
});