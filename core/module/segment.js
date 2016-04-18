"use strict";
exports.SegmentExr = function (db, mongodb, async, converter, prefix) {
	var me = this;
	var SegRet = require('./segmentresult.js').SegmentResult;
	var segRet = new SegRet(db, mongodb, converter, async, prefix);

	this.querySegment = function (appid, segmentid, field1, field2, callback) {
		var type1 = 'string', type2 = 'string';
		var numberfieldarr = ['age', 'height'];

		if (numberfieldarr.indexOf(field1) !== -1) type1 = 'number';
		if (numberfieldarr.indexOf(field2) !== -1) type2 = 'number';
		segRet.groupby(appid, segmentid, field1, type1, field2, type2, callback);
	};

	//Excute a segment based on segmentid
	this.excuteSegment = function (segmentid, callback) {
		db.collection(prefix + 'segment').find({_id: new mongodb.ObjectID(segmentid)}).toArray(function (err, segment) {
			if (err) throw err;
			me.runSegment(segment[0], callback);
		});
	};

	//Excute segment based on segment data
	this.runSegment = function runSegment(segment, callback) {
		var outcollection = prefix + "segment" + segment._id.toString();
		var col = db.collection(prefix + segment._appid);
		getQuery(segment.condition, function (out) {
			col.mapReduce(out.map, out.reduce, {
				out: outcollection,
				query: out.option,
				finalize: out.finalize,
				sort: {_mtid: 1}
			}, function (err) {
				if (err) throw err;
				var cursor = db.collection(outcollection).find({value: 1.0});
				doNext();

				// inject segment into user
				var arr = []; //array of userid Object (not string)
				function updateUser(next) {
					var bulk = col.initializeUnorderedBulkOp();
					for (var i in arr) if (arr.hasOwnProperty(i))
						bulk.find({_id: arr[i]}).update({$addToSet: {_segments: segment._id}});

					// clean the array first
					arr = [];

					bulk.execute(function (err, res) {
						if (err) throw err;
						//console.log(err, res);
						next();
					});
				}

				// parse next document, split docs in to bunchs of 100 docs + n last docs
				// update bunch of 100 users
				function doNext() {
					cursor.next(function (err, doc) {

						// the last docs
						if (null == doc) return updateUser(function () {
							if(callback) callback(outcollection);
						});
						arr.push(doc._id);

						if (arr.length == 100) {
							// clean the stack by calling setTimeout
							setTimeout(function () {
								updateUser(doNext);
							}, 1);
						}
						else {
							return doNext();
						}
					});
				}
			});
		});
	};

	function getQuery(json, callback) {
		handleInput(json, function (r) {
			queryFilter(r, function (r) {
				buildMapReduce(json, function (ret) {
					ret.option = r;
					callback(ret);
				});
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
		if (length == 0) return callback({});

		query['$or'] = [];
		let c = 0;
		for (var i = 0; i < length; i += 2) {
			c++;

			conditionToQuery(object[i], function (r) {
				query['$or'].push(r);
				c--;
				if (c != 0) return;
				var hasUser = false;
				for (var i = 0; i < length; i += 2) {
					if (object[i].type == 'user') {
						hasUser = true;
						break;
					}
				}

				if (hasUser) return callback(query);

				converter.toID('_isUser', function (r) {
					var temp = {};
					temp[r] = true;
					query['$or'].push(temp);
					callback(query);
				});
			});
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
						var andQuery = {
							'$and': []
						};
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
						query = {
							"$and": [temp, query]
						};
					} else {
						query[r] = true;
					}
					callback(query);
				});
			} else {
				converter.toID('_typeid', function (r) {
					if (query['$or'] != undefined) {
						var temp = {};
						temp[r] = element.type;
						query = {
							'$and': [temp, query]
						};
					} else {
						query[r] = element.type;
					}
					callback(query);
				});
			}
		} else {
			converter.toID('_typeid', function (r) {
				query[r] = element.type;
				callback(query);
			});
		}
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

//purpose: build a piece of map function
//example: buildMapChunk({actiontype: "pageview", conditions: [{f: "count", field: "pid", operator: ">", value: 5, conditions: ["amount", ">", 5, "and", "price", "=", "dd"]})
//return: string contains compiled javascript code
//param: i=index of condition, for iteration purpose, condition=see example
	function buildChunk(ind, element, _typeid, element_field) {
		//var reducecondcode = "";
		var reduceinitcode = "";
		var reduceaggcode = "";
		var finalizecode = "";
		var finalizeinitcode = "";

		var code = 'if(this["' + _typeid + '"]==="' + element.type + '"){';
		//var conditions = element.conditions;
		var defvalcode = "";
		//var aggcode = "";
		//get the condition code
		if (element.conditions === undefined) console.log(element);
		var inlineconditions = true; //buildConditionsCode(element.conditions);

		//if the query is to count then just map 1, but if the query is to sum
		// and calculate average then have to map field's value
		if (element.f === "count") {
			code += "value.f" + ind + "=(" + inlineconditions + ")?1:0;";
			reduceinitcode += "returnObject.f" + ind + "=0;";
			reduceaggcode += "if(value.f" + ind + "===undefined) value.f" + ind + "=0;returnObject.f" + ind + "+=value.f" + ind + ";";
			defvalcode += "value.f" + ind + "=0;";
			finalizecode += "(returnObject.f" + ind + element.operator + JSON.stringify(element.value) + ")";
			finalizeinitcode += "if(value.f" + ind + "==null) value.f" + ind + "=0;";
		} else if (element.f === "sum") {
			code += "value.f" + ind + "=(" + inlineconditions + ")?this." + element_field + ":0;";
			reduceinitcode += "returnObject.f" + ind + "=0;";
			reduceaggcode += "if(value.f" + ind + "===undefined) value.f" + ind + "=0;returnObject.f" + ind + "+=value.f" + ind + ";";
			defvalcode += "value.f" + ind + "=0;";
			finalizecode += "(returnObject.f" + ind + element.operator + JSON.stringify(element.value) + ")";
			finalizeinitcode += "if(value.f" + ind + "==null) value.f" + ind + "=0;";
		} else if (element.f === "avg") {
			code += "value.f" + ind + "_1=(" + inlineconditions + ")?this." + element_field + ":0;";
			code += "value.f" + ind + "_2=(" + inlineconditions + ")?1:0;";
			reduceinitcode += "returnObject.f" + ind + "_1=0;";
			reduceaggcode += "if(value.f" + ind + "_1===undefined) value.f" + ind + "_1=0;returnObject.f" + ind + "_1+=value.f" + ind + "_1;";
			reduceinitcode += "returnObject.f" + ind + "_2=0;";
			reduceaggcode += "if(value.f" + ind + "_2===undefined) value.f" + ind + "_2=0;returnObject.f" + ind + "_2+=value.f" + ind + "_2;";
			defvalcode += "value.f" + ind + "_1=0;";
			defvalcode += "value.f" + ind + "_2=0;";
			finalizecode += "(1.0*value.f" + ind + "_1/value.f" + ind + "_2" + element.operator + JSON.stringify(element.value) + ")";
			finalizeinitcode += "if(value.f" + ind + "_1==null) value.f" + ind + "_1=0;";
			finalizeinitcode += "if(value.f" + ind + "_2==null || value.f" + ind + "_2==0) value.f" + ind + "_2=1;";
		} else throw "wrong operator " + element;

		code = defvalcode + code + "};";
		return {
			mapcode: code,
			reduceinitcode: reduceinitcode,
			reduceaggcode: reduceaggcode,
			finalizecode: finalizecode,
			finalizeinitcode: finalizeinitcode
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
		var finalizeinitcode = "";
		//get all string need to convert to db
		var zipfield = [];
		var i = 0;
		while (i < query.length) {
			if (i % 2 == 0) zipfield.push(query[i].field);
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
					//reducecondcode += tmpcode.reducecondcode;
					reduceaggcode += tmpcode.reduceaggcode;
					finalizecode += tmpcode.finalizecode;
					finalizeinitcode += tmpcode.finalizeinitcode;
				} else {
					var joinop = query[i];
					if (joinop === 'and') joinop = '&&';
					else if (joinop === 'or') joinop = '||';
					else throw "wrong join operator: " + joinop;
					//reducecondcode += joinop;
				}
				i++;
			}
			var mapinitcode = 'function(){var value={};var userid=-1;if(this["' + ids._isUser + '"]==true){userid=this["' + ids._mtid + '"];value._hasUser=true;}else{userid=this["' + ids._mtid + '"];';
			mapfunccode = mapinitcode + mapfunccode + "}emit(userid,value);}";
			var reducefunccode = "function(key,values){var returnObject={};" + reduceinitcode + "for(var i in values){var value=values[i];if(value._hasUser!==undefined)returnObject._hasUser=true;" + reduceaggcode + "};return returnObject;}";
			finalizecode = 'function(key, value){' + finalizeinitcode + 'return ' + finalizecode + (finalizecode.length > 0 ? "&&" : "") + 'value._hasUser?1:0}';
			if (callback !== undefined)
				callback({
					map: mapfunccode,
					reduce: reducefunccode,
					finalize: finalizecode
				});
		});
	}
};