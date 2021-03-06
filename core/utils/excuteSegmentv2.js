"use strict";

var IDMgr = require('./fakeidmanager.js'),
	 async = require('async'),
	 mongodb = require('mongodb'),
	 converter = new IDMgr.IdManager(),
	 config = require('config');

//Chú ký triển khai hàm sinh match
//phải chia ra làm 2 loại, phép toán trên người và action

exports.createSegment = function (segment, callback) {
	var outcollection = config.get('mongod.prefix') + "segment" + segment._id.toString();
	getQuery(segment.query, function (out) {
		db.collection(collection).mapReduce(out.map, out.reduce, {
			out: outcollection,
			query: out.option,
			finalize: out.finalize,
			sort: {_mtid: 1}
		}, function (res) {
			callback(outcollection);
		});
	});
};

exports.getQuery = function getQuery(json, callback) {
	handleInput(json, function (r) {
		queryFilter(r, function (r) {
			buildMapReduce(json, function (ret) {
				ret.option = r;
				callback(ret);
			});
		});
	})
};

function updateDB(actionC, reduceC, segmentID, callback) {
	var _mtid = '';
	var _segments = '';
	converter.toIDs(['_mtid', '_segments'], function (ids) {
		_mtid = ids['_mtid'];
		_segments = ids['_segments'];

		var cursor = db.collection(reduceC).find({isIn: true}, {_id: 1}).batchSize(100);
		var _mtids = [];
		var done = false;

		async.whilst(function () {
			return done == false;
		}, function (callback) {
			cursor.next(function (err, r) {
				if (err) return callback(err);
				
				if (r) {
					_mtids.push(r._id);
					if (_mtids.length == 100) {
						var query = {};
						var update = {'$addToSet': {}};
						query[_mtid] = {'$in': _mtids};
						update['$addToSet'][_segments] = new mongodb.ObjectID(segmentID);
						db.collection(actionC).updateMany(query, update);
						db.collection(actionC).updateMany({_id: {'$in': _mtids}}, update);
						_mtids = [];
					}
				} else {
					if(_mtids.length != 0) {
						var query = {};
						var update = {'$addToSet': {}};
						query[_mtid] = {'$in': _mtids};
						update['$addToSet'][_segments] = new mongodb.ObjectID(segmentID);
						db.collection(actionC).updateMany(query, update);
						db.collection(actionC).updateMany({_id: {'$in': _mtids}}, update);
					}
					done = true;
				}
				callback(null);
			});
		}, function (err) {
			callback(err);
		});
	});
}

// ----------------------------------------------------
function handleInput(object, callback) {
	var counti = 0;
	var countj = 0;
	for (let i = 0; i < object.length; i += 2) {
		counti++;
		if (object[i].type === 'user') {
			counti--;
			if (object[i].conditions != undefined) {
				for (let j = 0; j < object[i].conditions.length; j += 4) {
					countj++;
					converter.toID(object[i].conditions[j], function (r) {
						object[i].conditions[j] = r;
						countj--;
						if (counti == 0 && countj == 0) {
							callback(object);
						}
					});
				}
				if (object[i].conditions.length == 0) {
					callback(object);
				}
			} else if (counti == 0) {
				callback(object);
			}
		} else {
			converter.toID(object[i].field, function (r) {
				counti--;
				object[i].field = r;
				if (object[i].conditions != undefined) {
					for (let j = 0; j < object[i].conditions.length; j += 4) {
						countj++;
						converter.toID(object[i].conditions[j], function (r) {
							object[i].conditions[j] = r;
							countj--;
							if (counti == 0 && countj == 0) {
								callback(object);
							}
						});
					}
					if (object[i].conditions.length == 0) {
						callback(object);
					}
				} else if (counti == 0) {
					callback(object);
				}
			});
		}
	}
}

function queryFilter(object, callback) {

	var length = object.length;
	var query = {};

	if (length != 0) {
		query['$or'] = [];
		let c = 0;
		for (let i = 0; i < length; i += 2) {
			c++;
			conditionToQuery(object[i], function (r) {
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
						callback(query);
					} else {
						converter.toID('_isUser', function (r) {
							var temp = {};
							temp[r] = true;
							query['$or'].push(temp);
							callback(query);
						});
					}
				}
			});
		}
	} else {
		callback({});
	}

}

function conditionToQuery(element, callback) {
	var query = {};

	//you can decrease indenting by putting the else in front of the if
	if (element.conditions != undefined) {
		var conditions = element.conditions;
		var size = conditions.length;
		var hasOr = false;
		// you dont have to check for <or> operator, <or> and <and> operator
		// are treated same way, just delete the loop and the if
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
			converter.toID('_isUser', function (r) {
				if (query['$or'] != undefined) {
					var temp = {};
					temp[r] = true;
					query = {"$and": [temp, query]};
				} else {
					query[r] = true;
				}
				callback(query);
			});
		} else {
			converter.toID('_typeid', function (r) {
				if (query['$or'] != undefined) {
					var temp = {};
					temp[r] = new mongodb.ObjectID(element.type);
					query = {'$and': [temp, query]};
				} else {
					query[r] = new mongodb.ObjectID(element.type);
				}
				callback(query);
			});
		}
	} else {
		converter.toID('_typeid', function (r) {
			query[r] = new mongodb.ObjectID(element.type);
			callback(query);
		});
	}
}

function buildQuery(condition) {

}

//really, put conditions[i+2] to a variable, its much easier to read
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
			};
			break;
		case 'ncon':
			query[conditions[i]] = {
				'$regex': "^((?!" + conditions[i + 2] + ").)*$/"
			};
			break;
		case 'sw':
			query[conditions[i]] = {
				'$regex': '^' + conditions[i + 2]
			};
			break;
		case 'ew':
			query[conditions[i]] = {
				'$regex': conditions[i + 2] + '$'
			};
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
			 conditions: ['age', 'eq', 'male']
		 }];

//handleInput(testJson)
//		.then(function (r) {
//			console.log(r);
//			return queryFilter(r);
//		}).then(function (r) {
//	console.log(JSON.stringify(r));
//});


//purpose: build a piece of map function
//example: buildMapChunk({actiontype: "pageview", conditions: [{f: "count", field: "pid", operator: ">", value: 5, conditions: ["amount", ">", 5, "and", "price", "=", "dd"]})
//return: string contains compiled javascript code
//param: i=index of condition, for iteration purpose, condition=see example
function buildChunk(ind, element, _typeid, element_field) {
	//var reducecondcode = "";
	var reduceinitcode = "";
	var reduceaggcode = "";
	var finalizecode = "";

	var code = 'if(this["' + _typeid + '"].str==="' + element.type + '"){';
	//var conditions = element.conditions;
	var defvalcode = "";
	//var aggcode = "";
	//get the condition code
	if (element.conditions === undefined) throw "wrong condition, element: " + JSON.parse(element);
	var inlineconditions = true;//buildConditionsCode(element.conditions);

	//if the query is to count then just map 1, but if the query is to sum
	// and calculate average then have to map field's value
	if (element.f === "count") {
		code += "value.f" + ind + "=(" + inlineconditions + ")?1:0;";
		reduceinitcode += "returnObject.f" + ind + "=0;";
		reduceaggcode += "if(value.f" + ind + "===undefined) value.f" + ind + "=0;returnObject.f" + ind + "+=value.f" + ind + ";";
		defvalcode += "value.f" + ind + "=0;";
		finalizecode += "(returnObject.f" + ind + element.operator + JSON.stringify(element.value) + ")";
	}
	else if (element.f === "sum") {
		code += "value.f" + ind + "=(" + inlineconditions + ")?this." + element_field + ":0;";
		reduceinitcode += "returnObject.f" + ind + "=0;";
		reduceaggcode += "if(value.f" + ind + "===undefined) value.f" + ind + "=0;returnObject.f" + ind + "+=value.f" + ind + ";";
		defvalcode += "value.f" + ind + "=0;";
		finalizecode += "(returnObject.f" + ind + element.operator + JSON.stringify(element.value) + ")";
	}
	else if (element.f === "avg") {
		code += "value.f" + ind + "_1=(" + inlineconditions + ")?this." + element_field + ":0;";
		code += "value.f" + ind + "_2=(" + inlineconditions + ")?1:0;";
		reduceinitcode += "returnObject.f" + ind + "_1=0;";
		reduceaggcode += "if(value.f" + ind + "_1===undefined) value.f" + ind + "_1=0;returnObject.f" + ind + "_1+=value.f" + ind + "_1;";
		reduceinitcode += "returnObject.f" + ind + "_2=0;";
		reduceaggcode += "if(value.f" + ind + "_2===undefined) value.f" + ind + "_2=0;returnObject.f" + ind + "_2+=value.f" + ind + "_2;";
		defvalcode += "value.f" + ind + "_1=0;";
		defvalcode += "value.f" + ind + "_2=0;";
		finalizecode += "(1.0*value.f" + ind + "_1/value.f" + ind + "_2" + element.operator + JSON.stringify(element.value) + ")";
	}
	else throw "wrong operator " + element;

	code = defvalcode + code + "};";
	return {
		mapcode: code,
		reduceinitcode: reduceinitcode,
		reduceaggcode: reduceaggcode,
		finalizecode: finalizecode
	};
}

//purpose: build a javascript map function from a json query
//example: buildMapFunction(testJson)
//return: string contains compiled javascript code
//param: query=see testJson
function buildMapReduce(query, callback) {

	var mapfunccode = "";
	var reducecondcode = "";
	var reduceinitcode = "";
	var reduceaggcode = "";
	var finalizecode = "";

	//get all string need to convert to db
	var zipfield = [];
	var i = 0;
	while (i < query.length) {
		if (i % 2 == 0) {
			zipfield.push(query[i].field);
		}
		i++;
	}
	zipfield = zipfield.concat(['_isUser', '_segments', '_id', '_mtid', '_typeid']);

	i = 0;
	converter.toIDs(zipfield, function (ids) {
		while (i < query.length) {
			if (i % 2 == 0) {
				//ignore user type
				if (query[i].type == 'user') {
					i++;
					continue;
				}

				var tmpcode = buildChunk(i / 2, query[i], ids._typeid, ids[query[i].field]);
				mapfunccode += tmpcode.mapcode;
				reduceinitcode += tmpcode.reduceinitcode;
				reducecondcode += tmpcode.reducecondcode;
				reduceaggcode += tmpcode.reduceaggcode;
				finalizecode += tmpcode.finalizecode;
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
		var mapinitcode = 'function(){var value={};var userid=-1;if(this["' + ids._isUser + '"]==true){userid=this["' + ids._mtid + '"];value._hasUser=true;}else{userid=this["' + ids._mtid + '"];';
		mapfunccode = mapinitcode + mapfunccode + "}emit(userid,value);}";
		var reducefunccode = "function(key,values){var returnObject={};" + reduceinitcode + "var hasUser=false;for(var i in values){var value=values[i];if(value._hasUser!==undefined)returnObject._hasUser=value._hasUser;" + reduceaggcode + "};return returnObject;}";
		finalizecode = 'function(key, value){return' + finalizecode + '&&value._hasUser?1:0}';
		if (callback !== undefined)
			callback({map: mapfunccode, reduce: reducefunccode, finalize: finalizecode});
	});
}

//function () {
//	var value = {};
//	var userid = -1;
//	if (this["_isUser"] == true) {
//		if (this["_segments"].indexOf(ObjectId("adc43c")) == -1)return;
//		userid = this["_id"];
//		value._hasUser = true;
//	} else {
//		if (this["_segments"].indexOf(ObjectId("adc43c")) == -1) return;
//		userid = this["_mtid"];
//		value.f0_1 = 0;
//		value.f0_2 = 0;
//		if (this["undefined"] === ObjectId("56e3a14a44ae6d70ddbf82a2")) {
//			value.f0_1 = (true) ? this.amount : 0;
//			value.f0_2 = (true) ? 1 : 0;
//		}
//		;
//		value.f1 = 0;
//		if (this["undefined"] === ObjectId("56e3a14a44ae6d70ddbf82a2")) {
//			value.f1 = (true) ? 1 : 0;
//		}
//		;
//	}
//	emit(userid, value);
//}

