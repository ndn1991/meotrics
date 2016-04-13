exports.SegmentResult = function (db, mongodb, converter, async, prefix) {
	var me = this;

	me.groupby = function (appid, segmentid, field1, type1, field2, type2, callback) {
		var collection = prefix + appid;
		if (field2 == undefined) {
			if ((type1 == 'string') || (type1 == 'array'))
				oneFieldString(collection, segmentid, field1, callback);
			else
				oneFieldNumber(collection, segmentid, field1, callback);
		} else {
			if (type1 == 'string' && type2 == 'string') {
				stringstring(collection, segmentid, field1, field2, callback);
			} else {
				if (type1 == 'number')
					if (type2 == 'number')
						numbernumber(collection, segmentid, field1, field2, callback);
					else
						numberstring(collection, segmentid, field1, field2, callback);
				else
					stringnumber(collection, segmentid, field1, field2, callback);
			}
		}
	};

	function stringnumber(collection, segmentid, field1, field2, callback) {
		converter.toIDs(['_isUser', '_segments', field1, field2], function (ids) {
			var maxfield2;
			var minfield2;

			var query = {};
			var sort = {};
			query[ids['_isUser']] = true;
			sort[ids[field2]] = -1;
			db.collection(collection).find(query).sort(sort).limit(1).toArray().then(function (r) {
				maxfield2 = r[0][ids[field2]];
				sort[ids[field2]] = 1;
				return db.collection(collection).find(query).sort(sort).limit(1).toArray();
			}).then(function (r) {
				minfield2 = r[0][ids[field2]];

				if ((typeof minfield2 == typeof maxfield2) && (typeof minfield2 == 'number')) {
					var matchClause = {"$match": {}};
					matchClause['$match'][ids['_isUser']] = true;
					//matchClause['$match'][ids['_segments']] = new mongodb.ObjectID(segmentid);

					var results2 = range(minfield2, maxfield2, field2);
					var spaces2 = results2.length;

					var prefix2 = "prefix2_";
					var projectClause2 = projectRange(results2, field2, prefix2);
					projectClause2["$project"][field1] = 1;

					var groupClause = {"$group": {}};
					groupClause["$group"]["_id"] = "$" + field1;

					for (var i = 0; i < spaces2; i++) {
						groupClause["$group"][prefix2 + i] = {"$sum": "$" + prefix2 + i};
					}

					groupClause["$group"]["count"] = {"$sum": 1};

					var cursor = db.collection(collection).aggregate([
						matchClause,
						projectClause2,
						groupClause
					], {
						cursor: {batchSize: 20},
						allowDiskUse: true
					}).toArray().then(function (r) {
						var results = [];
						for (var i = 0; i < r.length; i++) {
							results[i] = {};
							results[i].key = r[i]._id;
							results[i].count = r[i].count;
							results[i].values = [];
							for (var j = 0; j < spaces2; j++) {
								results[i].values[j] = {};
								results[i].values[j].key = results2[j].key;
								results[i].values[j].count = r[i][prefix2 + j];
							}
						}
						callback(null, results);
					}).catch(function (e) {
						callback(e);
					});
				} else {
					callback(new Error('Type data is wrong'));
				}
			});
		});
	}

	function numberstring(collection, segmentid, field1, field2, callback) {
		converter.toIDs(['_isUser', '_segments', field1, field2], function (ids) {
			var maxfield1;
			var minfield1;

			var query = {};
			var sort = {};
			query[ids['_isUser']] = true;
			sort[ids[field1]] = -1;
			db.collection(collection).find(query).sort(sort).limit(1).toArray().then(function (r) {
				maxfield1 = r[0][ids[field1]];
				sort[ids[field1]] = 1;
				return db.collection(collection).find(query).sort(sort).limit(1).toArray();
			}).then(function (r) {
				minfield1 = r[0][ids[field1]];
				if ((typeof minfield1 == typeof maxfield1) && (typeof minfield1 == 'number')) {
					var matchClause = {"$match": {}};
					matchClause['$match'][ids['_isUser']] = true;
					//matchClause['$match'][ids['_segments']] = new mongodb.ObjectID(segmentid);

					var results1 = range(minfield1, maxfield1, field1);
					var spaces1 = results1.length;

					var prefix1 = "prefix1_";
					var projectClause1 = projectRange(results1, field1, prefix1);
					projectClause1["$project"][field2] = 1;

					var groupClause1 = {"$group": {}};
					var temp = {};
					for (var i = 0; i < spaces1; i++) {
						temp[prefix1 + i] = "$" + prefix1 + i
					}
					temp[field2] = "$" + field2;
					groupClause1["$group"]["_id"] = temp;
					groupClause1["$group"]["count"] = {"$sum": 1};

					var groupClause2 = {"$group": {}};

					temp = {};
					for (var i = 0; i < spaces1; i++) {
						temp[prefix1 + i] = "$_id." + prefix1 + i
					}
					groupClause2["$group"]["_id"] = temp;
					groupClause2["$group"]["values"] = {
						"$push": {
							"key": "$_id." + field2,
							"count": "$count"
						}
					}

					var cursor = db.collection(collection).aggregate([
						matchClause,
						projectClause1,
						groupClause1,
						groupClause2
					], {
						cursor: {batchSize: 20},
						allowDiskUse: true
					}).toArray().then(function (r) {
						for (var i = 0; i < r.length; i++) {
							for (j = 0; j < spaces1; j++) {
								if (r[i]["_id"][prefix1 + j] == 1) {
									results1[j].values = r[i].values;
									results1[j].count = r[i].count;
								}
							}
						}
						callback(null, results1);
					}).catch(function (e) {
						callback(e);
					});
				} else {
					callback(new Error('Type data is wrong'));
				}
			});
		});
	}

	function numbernumber(collection, segmentid, field1, field2, callback) {

		converter.toIDs(['_isUser', '_segments', field1, field2], function (ids) {
			var maxfield1;
			var minfield1;
			var maxfield2;
			var minfield2;

			var query = {};
			var sort = {};
			query[ids['_isUser']] = true;
			sort[ids[field1]] = -1;
			db.collection(collection).find(query).sort(sort).limit(1).toArray().then(function (r) {
				maxfield1 = r[0][ids[field1]];
				sort[ids[field1]] = 1;
				return db.collection(collection).find(query).sort(sort).limit(1).toArray();
			}).then(function (r) {
				minfield1 = r[0][ids[field1]];
				if ((typeof minfield1 == typeof maxfield1) && (typeof minfield1 == 'number')) {
					sort = {};
					sort[ids[field2]] = -1;
					db.collection(collection).find(query).sort(sort).limit(1).toArray().then(function (r) {
						maxfield2 = r[0][ids[field2]];
						sort[ids[field2]] = 1;
						return db.collection(collection).find(query).sort(sort).limit(1).toArray();
					}).then(function (r) {
						minfield2 = r[0][ids[field2]];

						if ((typeof minfield2 == typeof maxfield2) && (typeof minfield2 == 'number')) {
							var matchClause = {"$match": {}};
							matchClause['$match'][ids['_isUser']] = true;
							//matchClause['$match'][ids['_segments']] = new mongodb.ObjectID(segmentid);

							var results1 = range(minfield1, maxfield1, field1);

							var prefix1 = "prefix1_";
							var projectClause1 = projectRange(results1, field1, prefix1);


							var results2 = range(minfield2, maxfield2, field2);
							var prefix2 = "prefix2_";
							var projectClause2 = projectRange(results2, field2, prefix2);

							delete projectClause2["$project"]["_id"];
							var keys = Object.keys(projectClause2["$project"]);
							for (var i = 0; i < keys.length; i++) {
								projectClause1["$project"][keys[i]] = projectClause2["$project"][keys[i]];
							}

							var projectClause = projectClause1;

							var spaces1 = results1.length;
							var spaces2 = results2.length;

							var groupClause1 = {"$group": {}};
							var temp = {};
							for (var i = 0; i < spaces1; i++) {
								temp[prefix1 + i] = "$" + prefix1 + i
							}
							//console.log(temp);
							groupClause1["$group"]["_id"] = temp;

							for (var i = 0; i < spaces2; i++) {
								groupClause1["$group"][prefix2 + i] = {"$sum": "$" + prefix2 + i};
							}

							groupClause1["$group"]["count"] = {"$sum": 1};

							var cursor = db.collection(collection).aggregate([
								matchClause,
								projectClause,
								groupClause1
							], {
								cursor: {batchSize: 20},
								allowDiskUse: true
							}).toArray().then(function (r) {
								var results = [];

								for (var i = 0; i < r.length; i++) {
									for (var j = 0; j < spaces1; j++) {
										if (r[i]["_id"][prefix1 + j] == 1) {

											results[j] = {};
											results[j].key = results1[j].key;
											results[j].count = r[i].count;
											results[j].values = [];
											for (var k = 0; k < spaces2; k++) {
												results[j].values[k] = {};
												results[j].values[k].key = results2[k].key;
												results[j].values[k].count = r[i][prefix2 + k];
											}
											break;
										}
									}
								}
								for (var i = 0; i < spaces1; i++) {
									if (results[i] == null) {
										results[i] = {};
										results[i].key = results1[i].key;
										results[i].count = results1[i].count;
									}
								}
								callback(null, results);
							}).catch(function (e) {
								callback(e);
							});

						} else {
							callback(new Error('Type data is wrong'));
						}
					});
				} else {
					callback(new Error('Type data is wrong'));
				}
			});
		});
	}

	function stringstring(collection, segmentid, field1, field2, callback) {
		converter.toIDs(['_isUser', '_segments', field1, field2], function (ids) {
			var matchClause = getMatchClause(ids, segmentid);

			// build project clause
			var projectClause = {$project: {_id: 0}};
			projectClause.$project[ids[field1]] = 1;
			projectClause.$project[ids[field2]] = 1;

			var groupClause1 = {
				$group: {
					_id: {
						field1: "$" + ids[field1],
						field2: "$" + ids[field2]
					},
					count: {$sum: 1}
				}
			};

			var groupClause2 = {
				$group: {
					_id: "$_id.field1",
					count: {$sum: '$count'},
					values: {
						$push: {
							key: "$_id.field2",
							count: '$count'
						}
					}
				}
			};

			db.collection(collection).aggregate([matchClause, projectClause, groupClause1, groupClause2]).toArray(function (err, docs) {
				if (err) throw err;
				for (var i in docs) if (docs.hasOwnProperty(i)) {
					docs[i].key = docs[i]._id;
					delete docs[i]._id;
				}
				callback(docs);
			});
		});
	}

	// purpose: build match clause of user in a segment
	function getMatchClause(ids, segmentid) {
		var matchClause = {$match: {$and: []}};

		// must be a user condition
		var mustbeuser = {};
		mustbeuser[ids._isUser] = true;
		matchClause.$match.$and.push(mustbeuser);

		// must be in the segmetn condition
		var mustbeinsegment = {};
		mustbeinsegment[ids._segments] = {$elemMatch: {$eq: new mongodb.ObjectId(segmentid)}};
		matchClause.$match.$and.push(mustbeinsegment);

		return matchClause;
	}

	function oneFieldString(collection, segmentid, field1, callback) {
		converter.toIDs(['_isUser', '_segments', field1], function (ids) {
			//build match clause
			var matchClause = getMatchClause(ids, segmentid);

			//build project clause
			var projectClause = {$project: {_id: 0}};
			projectClause.$project[ids[field1]] = 1;

			var groupClause = {
				$group: {
					_id: '$' + ids[field1],
					count: {
						$sum: 1
					}
				}
			};
			var cursor = db.collection(collection).aggregate([matchClause, projectClause, groupClause]).toArray(function (err, docs) {
				if (err) throw err;
				for (var i in docs) if (docs.hasOwnProperty(i)) {
					docs[i].key = docs[i]._id;
					delete docs[i]._id;
				}
				callback(docs);
			});
		});
	}

	function oneFieldNumber(collection, segmentid, field1, callback) {
		converter.toIDs(['_isUser', '_segments', field1], function (ids) {
			// build match clause
			var matchClause = getMatchClause(ids, segmentid);

			//build min max group
			var mmgroupclause = {
				$group: {
					_id: "$" + ids._isUser,
					min: {$min: "$" + ids[field1]},
					max: {$max: "$" + ids[field1]}
				}
			};

			//find min, max
			db.collection(collection).aggregate([matchClause, mmgroupclause]).toArray(function (err, minmax) {
				if (err)throw err;
				var max = parseFloat(minmax[0].max);
				var min = parseFloat(minmax[0].min);
				var prefix = "range_";

				// make the range in project clause
				var results = range(min, max, field1);
				var projectClause = projectRange(results, field1, prefix);

				// build group clause
				var groupClause = {'$group': {_id: null}};

				var length = results.length;
				for (var i = 0; i < length; i++) {
					var fieldName = prefix + i;
					groupClause.$group[fieldName] = {$sum: '$' + fieldName};
				}

				db.collection(collection).aggregate([matchClause, projectClause, groupClause]).toArray(function (err, r) {
					if (err) throw err;
					var temp = r[0];
					for (var i = 0; i < length; i++) {
						var fieldName = prefix + i;
						results[i].count = temp[fieldName];
					}
					callback(results);
				});

			});
		});
	}

// purpose: split field value domain in to smaller domain
// ouput: array of smaller domains [{count:0, key:{from, to}},...]
	function range(min, max, field) {
		var results = [];
		//if field is age then split into [18, 24, 24, 44, 54, 54+]
		if (field == 'age') {
			results[0] = {count: 0, key: {to: 18}};
			results[1] = {count: 0, key: {from: 18, to: 24}};
			results[2] = {count: 0, key: {from: 24, to: 34}};
			results[3] = {count: 0, key: {from: 34, to: 44}};
			results[4] = {count: 0, key: {from: 44, to: 54}};
			results[5] = {count: 0, key: {from: 54}};
		} else {
			//else split in to 5 equal space using min, max
			var spaces = 1;
			var distance = 0;

			if (max - min >= 5) {
				spaces = 5;
				distance = Math.floor((max - min) / 5);
			}

			for (var i = 0; i < spaces; i++) {
				var element = {};
				element.key = {
					from: min + i * distance,
					to: min + (i + 1) * distance
				};
				if (i == spaces - 1) {
					element.key.to = max;
				}
				element.count = 0;
				results.push(element);
			}
		}
		return results;
	}

// purpose: get project clause from field and value domains
// output: a mongodb project clause
	// params:
	// + domains: list of domain
	// + field: string contains name of field
	function projectRange(domains, field, prefix) {
		var projectClause = {$project: {}};
		projectClause.$project._id = 0;

		for (var i = 0; i < domains.length; i++) {
			var temp = domains[i];
			var fieldName = prefix + i;
			var element = {'$cond': []};
			var boolexp = {};

			if (temp.key.from !== undefined) {
				boolexp.$gt = ['$' + field, temp.key.from];
				if (i == 0) {
					boolexp.$gte = boolexp.$gt;
					delete boolexp.$gt;
				}
			}

			if (temp.key.to !== undefined) {
				var bool2 = {$lte: ['$' + field, temp.key.to]};
				boolexp = boolexp.$gt == undefined && boolexp.$gte == undefined ? boolexp = bool2 : {$and: [boolexp, bool2]};
			}

			element.$cond.push(boolexp, 1, 0);
			projectClause.$project[fieldName] = element;
		}
		return projectClause;
	}
};