"use strict";

var IDMgr = require('./utils/idmanager.js'),
		async = require('async'),
		mongodb = require('mongodb'),
		converter = new IDMgr.IdManager();

function handleInput(object) {
	var sucback;
	var errback;
	var p = new Promise(function (resolve, reject) {
		sucback = resolve;
		errback = reject;
	});

	var counti = 0;
	var countj = 0;
	for (let i = 0; i < object.length; i += 2) {
		counti++;
		if (object[i].type === 'user') {
			counti--;
			if (object[i].conditions != undefined) {
				for (let j = 0; j < object[i].conditions.length; j += 4) {
					countj++;
					converter.toID(object[i].conditions[j])
							.then(function (r) {
								object[i].conditions[j] = r;
								countj--;
								if (counti == 0 && countj == 0) {
									sucback(object);
								}
							}).catch(function (e) {
						errback(e);
					});
				}
			} else if (counti == 0) {
				sucback(object);
			}
		} else {
			converter.toID(object[i].field)
					.then(function (r) {
						counti--;
						object[i].field = r;
						if (object[i].conditions != undefined) {
							for (let j = 0; j < object[i].conditions.length; j += 4) {
								countj++;
								converter.toID(object[i].conditions[j])
										.then(function (r) {
											object[i].conditions[j] = r;
											countj--;
											if (counti == 0 && countj == 0) {
												sucback(object);
											}
										}).catch(function (e) {
									errback(e);
								});
							}
						} else if (counti == 0) {
							sucback(object);
						}
					}).catch(function (e) {
				errback(e);
			});
		}
	}
	return p;
}

function queryFilter(object) {
	var sucback;
	var errback;
	var p = new Promise(function (resolve, reject) {
		sucback = resolve;
		errback = reject;
	});

	var length = object.length;
	var query = {};

	if (length != 0) {
		query['$or'] = [];
		let c = 0;
		for (let i = 0; i < length; i += 2) {
			c++;
			conditionToQuery(object[i])
					.then(function (r) {
						query['$or'].push(r);
						c--;
						if (c == 0) {
							var hasUser = false;
							for (var i = 0; i < length; i += 2) {
								if (object[i].type == 'user') {
									hasUser = true;
									break;
								}
							}

							if (hasUser) {
								sucback(query);
							} else {
								converter.toID('_isUser')
										.then(function (r) {
											var temp = {};
											temp[r] = true;
											query['$or'].push(temp);
											sucback(query);
										}).catch(function (e) {
									errback(e);
								});
							}
						}
					}).catch(function (e) {
				errback(e);
			});
		}
	} else {
		sucback({});
	}

	return p;
}

function conditionToQuery(element) {
	var sucback;
	var errback;
	var p = new Promise(function (resolve, reject) {
		sucback = resolve;
		errback = reject;
	});

	var query = {};
	if (element.conditions != undefined) {
		var conditions = element.conditions;
		var size = conditions.length;
		var hasOr = false;
		for (var i = 3; i < size; i += 4) {
			if (conditions[i] == 'or') {
				hasOr = true;
				break;
			}
		}
		if (hasOr) {
			query['$or'] = [];
			for (var i = 0; i < size; i += 4) {
				if ((conditions[i + 3] == 'or') || (i + 3 == size)) {
					query['$or'].push(translateOperator(conditions, i));
				} else {
					for (var j = i + 7; j < size; j += 4) {
						if (conditions[j] == 'or') {
							break;
						}
					}
					var andQuery = {'$and': []};
					for (i; i < j; i += 4) {
						andQuery['$and'].push(translateOperator(conditions, i));
					}
					query['$or'].push(andQuery);
				}
			}
		} else {
			query = {};
			for (var i = 0; i < size; i += 4) {
				var returnValue = translateOperator(conditions, i);
				var key = Object.keys(returnValue)[0];
				query[key] = returnValue[key];
			}
		}

		if (element.type == 'user') {
			converter.toID('_isUser')
					.then(function (r) {
						console.log("USER");
						if (query['$or'] != undefined) {
							var temp = {};
							temp[r] = true;
							query = {"$and": [temp, query]};
						} else {
							query[r] = true;
						}
						sucback(query);
					}).catch(function (e) {
				errback(e);
			});
		} else {
			converter.toID('_typeid')
					.then(function (r) {
						console.log("NOT USER");
						if (query['$or'] != undefined) {
							var temp = {};
							temp[r] = new mongodb.ObjectID(element.type);
							query = {'$and': [temp, query]};
						} else {
							query[r] = new mongodb.ObjectID(element.type);
						}
						sucback(query);
					}).catch(function (e) {
				errback(e);
			});
		}
	} else {
		converter.toID('_typeid')
				.then(function (r) {
					query[r] = new mongodb.ObjectID(element.type);
					sucback(query);
				});
	}
	return p;
}

function translateOperator(conditions, i) {
	var query = {};
	switch (conditions[i + 1]) {
		case 'gt':
			query[conditions[i]] = {
				'$gt': conditions[i + 2]
			};
			break;
		case 'lt':
			query[conditions[i]] = {
				'$lt': conditions[i + 2]
			};
			break;
		case 'eq':
			query[conditions[i]] = conditions[i + 2];
			break;
		case 'ne':
			query[conditions[i]] = {
				'$ne': conditions[i + 2]
			};
			break;
		case 'gte':
			query[conditions[i]] = {
				'$gte': conditions[i + 2]
			};
			break;
		case 'lte':
			query[conditions[i]] = {
				'$lte': conditions[i + 2]
			};
			break;
		case 'con':
			query[conditions[i]] = {
				'$regex': conditions[i + 2]
			}
			break;
		case 'ncon':
			query[conditions[i]] = {
				'$regex': "^((?!" + conditions[i + 2] + ").)*$/"
			}
			break;
		case 'sw':
			query[conditions[i]] = {
				'$regex': '^' + conditions[i + 2]
			}
			break;
		case 'ew':
			query[conditions[i]] = {
				'$regex': conditions[i + 2] + '$'
			}
			break;
	}
	return query;
}

var testJson =
		[{
			type: "56e3a14a44ae6d70ddbf82a2", f: "avg", field: "amount", operator: ">", value: 5,
			conditions: ["amount", "gt", 2, "and", "price", "eq", 40]
		},
			"and",
			{
				type: "56e3a14a44ae6d70ddbf82a2", f: "count", field: "pid", operator: ">", value: 5,
				conditions: ["amount", "gt", 5, "or", "price", "eq", "30"]
			},
			"and",
			{
				type: 'user',
				conditions: []
			}];

handleInput(testJson)
		.then(function (r) {
			console.log(r);
			return queryFilter(r);
		}).then(function (r) {
	console.log(JSON.stringify(r));
});


//purpose: build a piece of map function
//example: buildMapChunk({actiontype: "pageview", conditions: [{f: "count", field: "pid", operator: ">", value: 5, conditions: ["amount", ">", 5, "and", "price", "=", "dd"]})
//return: string contains compiled javascript code
//param: i=index of condition, for iteration purpose, condition=see example
function buildChunk(ind, element) {
	var reducecondcode = "";
	var reduceinitcode = "";
	var reduceaggcode = "";

	var code = 'if(this.actiontype==="' + element.type + '"){';
	//var conditions = element.conditions;
	var defvalcode = "";
	//var aggcode = "";
	//get the condition code
	if (element.conditions === undefined) console.log(element);
	var inlineconditions = true;//buildConditionsCode(element.conditions);

	//if the query is to count then just map 1, but if the query is to sum
	// and calculate average then have to map field's value
	if (element.f === "count") {
		code += "value.f" + ind + "=(" + inlineconditions + ")?1:0;";
		reduceinitcode += "returnObject.f" + ind + "=0;";
		reduceaggcode += "returnObject.f" + ind + "+=value.f" + ind + ";";
		defvalcode += "value.f" + ind + "=0;";
		reducecondcode += "(value.f" + ind + element.operator + JSON.stringify(element.value) + ")";
	}
	else if (element.f === "sum") {
		code += "value.f" + ind + "=(" + inlineconditions + ")?this." + element.field + ":0;";
		reduceinitcode += "returnObject.f" + ind + "=0;";
		reduceaggcode += "returnObject.f" + ind + "+=value.f" + ind + ";";
		defvalcode += "value.f" + ind + "=0;";
		reducecondcode += "(value.f" + ind + element.operator + JSON.stringify(element.value) + ")";
	}
	else if (element.f === "avg") {
		code += "value.f" + ind + "_1=(" + inlineconditions + ")?this." + element.field + ":0;";
		code += "value.f" + ind + "_2=(" + inlineconditions + ")?1:0;";
		reduceinitcode += "returnObject.f" + ind + "_1=0;";
		reduceaggcode += "returnObject.f" + ind + "_1+=value.f" + ind + "_1;";
		reduceinitcode += "returnObject.f" + ind + "_2=0;";
		reduceaggcode += "returnObject.f" + ind + "_2+=value.f" + ind + "_2;";
		defvalcode += "value.f" + ind + "_1=0;";
		defvalcode += "value.f" + ind + "_2=0;";
		reducecondcode += "(1.0*value.f" + ind + "_1/value.f" + ind + "_2" + element.operator + JSON.stringify(element.value) + ")";
	}
	else throw "wrong operator";

	code = defvalcode + code + "};";
	return {
		mapcode: code,
		reduceinitcode: reduceinitcode,
		reducecondcode: reducecondcode,
		reduceaggcode: reduceaggcode
	};
}

//purpose: build a javascript map function from a json query
//example: buildMapFunction(testJson)
//return: string contains compiled javascript code
//param: query=see testJson
function buildMapReduce(segmentid, query, callback) {
	var mapfunccode = "";
	var reducecondcode = "";
	var reduceinitcode = "";
	var reduceaggcode = "";


	var i = 0;
	while (i < query.length) {
		if (i % 2 == 0) {
			var tmpcode = buildChunk(i / 2, query[i]);
			mapfunccode += tmpcode.mapcode;
			reduceinitcode += tmpcode.reduceinitcode;
			reducecondcode += tmpcode.reducecondcode;
			reduceaggcode += tmpcode.reduceaggcode;
		}
		else {
			var joinop = query[i];
			if (joinop === 'and') joinop = '&&';
			else if (joinop === 'or') joinop = '||';
			else throw "wrong join operator: " + joinop;
			reducecondcode += joinop;
		}
		i++;
	}

	var _isUser = 0;
	var _segments = 0;
	var _id = 0;
	var _mtid = 0;
	converter.toIDs(['_isUser', '_segments', '_id', '_mtid'], function (ids) {
		var mapinitcode = 'function(){var value={};var userid=-1;if(this["' + ids._isUser + '"]==true){if(this["' + ids._segments + '"].indexOf(ObjectId("' + segmentid + '"))==-1)return;userid=this["' + ids._id + '"];value=this;}else{if(this["' + ids._segments + '"].indexOf(ObjectId( "' + segmentid + '"))==-1) return;userid=this["' + ids._mtid + '"];';

		mapfunccode = mapinitcode + mapfunccode + "}emit(userid,value)}";
		var reducefunccode = "function(key,values){var returnObject={};" + reduceinitcode + "for(var i in values){var value=values[i];" + reduceaggcode + "};return " + reducecondcode + "?key:null;}";
		if (callback !== undefined)callback({map: mapfunccode, reduce: reducefunccode});
	});
}


function () {
	var value = {};
	var userid = -1;
	if (this["undefined"] == true) {
		if (this["undefined"].indexOf(ObjectId("adc43c")) == -1) return; else {
			userid = this["undefined"];
			value = this;
		}
	}
	else {
		if (this["undefined"].indexOf(ObjectId("adc43c")) == -1) return;
		userid = this["undefined"];
		value.f0_1 = 0;
		value.f0_2 = 0;
		if (this.actiontype === "56e3a14a44ae6d70ddbf82a2") {
			value.f0_1 = (true) ? this.amount : 0;
			value.f0_2 = (true) ? 1 : 0;
		}
		;
		value.f1 = 0;
		if (this.actiontype === "56e3a14a44ae6d70ddbf82a2") {
			value.f1 = (true) ? 1 : 0;
		}
		;
	}
	emit(userid, value)
}