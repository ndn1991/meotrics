﻿import * as mongo from 'mongodb';

export class DashboardEntity {
	public ctime:number;
	public appid:string;
	public n_new_visitor:number;
	public n_returning_visitor:number;
	public n_new_signup:number;
	public n_avgcartsize:number;
	public total_revenues:number[];
	public revenue_per_customer:number;
	public retention_rates:number[];
	public usergrowth_rate:number;
	public conversion_rate:number;
	public highest_revenue_campaign:string;
	public most_effective_ref:string;
	public most_popular_category: string;
}
export class Dashboard {
	private Lock = require('lock');
	private lock = this.Lock();

	public constructor(private db:mongo.Db, private converter, private prefix:string, private delaysec:number) {
	}

	private getNewSignup(db:mongo.Db, prefix:string, appid:string, ids, callback:(a:number)=>void) {
		var nowsec = Math.round(new Date().getTime() / 1000);
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		let todaysec = Math.round(today.getTime() / 1000);

		let me = this;
		let match = {};
		match[ids._ctime] = {$gte: todaysec};
		match[ids._typeid] = 'signup';
		match[ids._isUser] = {$exists: false};
		db.collection(prefix + "app" + appid).count(match, function (err, res) {
			if (err) throw err;
			callback(res);
		});
	}

	private getGrowRate(db:mongo.Db, prefix:string, appid:string, ids, callback:(a:number)=>void) {
		var nowsec = Math.round(new Date().getTime() / 1000);
		var last24hsec = nowsec - 24 * 3600;
		var last48hsec = nowsec - 48 * 3600;

		var pipeline = [{$match: {}}, {$group: {_id: "$" + ids._mtid}}, {
			$group: {
				_id: null, count: {$sum: 1}
			}
		}];

		//count unique today visitor
		pipeline[0]['$match'][ids._ctime] = {$gte: last24hsec};
		pipeline[0]['$match'][ids._isUser] = {$exists: false};
		db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
			if (err) throw err;
			if (res.length == 0) return callback(0);
			else {
				let todayvisitcount = res[0].count;
				//count yesterday unique visitor
				pipeline[0]['$match'][ids._ctime] = {$gte: last48hsec, $lt: last24hsec};
				db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
					if (err) throw err;
					if (res.length == 0) return callback(todayvisitcount);
					return callback(1.0 * todayvisitcount - res[0].count / res[0].count * 100);
				});
			}
		});
	}

	private getTotalRevenue(db:mongo.Db, prefix:string, appid:string, ids, callback:(revenue:number[], numberofpurchase:number)=>void) {
		var n_users:number[] = [];
		var n_users_purchase:number[] = [];
		var n_purchase = 0;
		var now = new Date();
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		let todaysec = Math.round(today.getTime() / 1000);
		let seventhdaybefore = todaysec - 7 * 24 * 3600;
		let b0 = todaysec;
		let b1 = b0 - 24 * 3600;
		let b2 = b1 - 24 * 3600;
		let b3 = b2 - 24 * 3600;
		let b4 = b3 - 24 * 3600;
		let b5 = b4 - 24 * 3600;
		let b6 = b5 - 24 * 3600;
		let b7 = b6 - 24 * 3600;
		let b8 = b7 - 24 * 3600;
		let b9 = b8 - 24 * 3600;
		let b10 = b9 - 24 * 3600;
		let b11 = b10 - 24 * 3600;
		let b12 = b11 - 24 * 3600;
		//let b13 = b12 - 24 * 3600;
		//let b14 = b13 - 24 * 3600;


		var revenues:number[] = [];
		var revenue_pipeline = [{$match: {}}, {
			$group: {
				_id: null, sum: {$sum: "$amount"}, count: {$sum: 1}
			}
		}];

		revenue_pipeline[0]['$match'][ids._typeid] = "purchase";
		revenue_pipeline[0]['$match'][ids._ctime] = {};
		revenue_pipeline[0]['$match'][ids._ctime].$gte = b6;
		revenue_pipeline[0]['$match'][ids._ctime].$lt = b5;
		db.collection(prefix + appid).aggregate(revenue_pipeline, function (err, res) {
			if (err) throw err;
			revenues.push(res.length === 0 ? 0 : res[0].sum);
			n_purchase += res[0].count;

			revenue_pipeline[0]['$match'][ids._ctime].$gte = b5;
			revenue_pipeline[0]['$match'][ids._ctime].$lt = b4;
			db.collection(prefix + appid).aggregate(revenue_pipeline, function (err, res) {
				if (err) throw err;
				revenues.push(res.length === 0 ? 0 : res[0].sum);
				n_purchase += res[0].count;

				revenue_pipeline[0]['$match'][ids._ctime].$gte = b4;
				revenue_pipeline[0]['$match'][ids._ctime].$lt = b3;
				db.collection(prefix + appid).aggregate(revenue_pipeline, function (err, res) {
					if (err) throw err;
					revenues.push(res.length === 0 ? 0 : res[0].sum);
					n_purchase += res[0].count;

					revenue_pipeline[0]['$match'][ids._ctime].$gte = b3;
					revenue_pipeline[0]['$match'][ids._ctime].$lt = b2;
					db.collection(prefix + appid).aggregate(revenue_pipeline, function (err, res) {
						if (err) throw err;
						revenues.push(res.length === 0 ? 0 : res[0].sum);
						n_purchase += res[0].count;

						revenue_pipeline[0]['$match'][ids._ctime].$gte = b2;
						revenue_pipeline[0]['$match'][ids._ctime].$lt = b1;
						db.collection(prefix + appid).aggregate(revenue_pipeline, function (err, res) {
							if (err) throw err;
							revenues.push(res.length === 0 ? 0 : res[0].sum);
							n_purchase += res[0].count;

							revenue_pipeline[0]['$match'][ids._ctime].$gte = b1;
							revenue_pipeline[0]['$match'][ids._ctime].$lt = b0;
							db.collection(prefix + appid).aggregate(revenue_pipeline, function (err, res) {
								if (err) throw err;
								revenues.push(res.length === 0 ? 0 : res[0].sum);
								n_purchase += res[0].count;

								revenue_pipeline[0]['$match'][ids._ctime] = {$gte: b0};
								db.collection(prefix + appid).aggregate(revenue_pipeline, function (err, res) {
									if (err) throw err;
									revenues.push(res.length === 0 ? 0 : res[0].sum);
									n_purchase += res[0].count;

									callback(revenues, n_purchase);
								});
							});
						});
					});
				});
			});
		});
	}

	private getUniqueVisitor(db:mongo.Db, prefix:string, appid:string, ids, callback:(u:number[])=>void) {
		var now = new Date();
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		var uniquevisitors = [];
		let todaysec = Math.round(today.getTime() / 1000);
		let b0 = todaysec;
		let b1 = b0 - 24 * 3600;
		let b2 = b1 - 24 * 3600;
		let b3 = b2 - 24 * 3600;
		let b4 = b3 - 24 * 3600;
		let b5 = b4 - 24 * 3600;
		let b6 = b5 - 24 * 3600;

		var pipeline = [{$match: {}}, {$group: {_id: "$" + ids._mtid}}, {
			$group: {
				_id: null, count: {$sum: 1}
			}
		}];

		pipeline[0]['$match'][ids._typeid] = "pageview";
		pipeline[0]['$match'][ids._ctime] = {$gte: b6, $lt: b5};
		db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
			if (err) throw err;
			uniquevisitors.push(res.length == 0 ? 0 : res.length);

			pipeline[0]['$match'][ids._ctime] = {$gte: b5, $lt: b4};
			db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
				if (err) throw err;
				uniquevisitors.push(res.length == 0 ? 0 : res.length);

				pipeline[0]['$match'][ids._ctime] = {$gte: b4, $lt: b3};
				db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
					if (err) throw err;
					uniquevisitors.push(res.length == 0 ? 0 : res.length);

					pipeline[0]['$match'][ids._ctime] = {$gte: b3, $lt: b2};
					db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
						if (err) throw err;
						uniquevisitors.push(res.length == 0 ? 0 : res.length);

						pipeline[0]['$match'][ids._ctime] = {$gte: b2, $lt: b1};
						db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
							if (err) throw err;
							uniquevisitors.push(res.length == 0 ? 0 : res.length);

							pipeline[0]['$match'][ids._ctime] = {$gte: b1, $lt: b0};
							db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
								if (err) throw err;
								uniquevisitors.push(res.length == 0 ? 0 : res.length);

								pipeline[0]['$match'][ids._ctime] = {$gte: b0};
								db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
									if (err) throw err;
									uniquevisitors.push(res.length == 0 ? 0 : res.length);
									callback(uniquevisitors);
								});
							});
						});
					});
				});
			});
		});
	}

	private getRetensionRates(db:mongo.Db, prefix:string, appid:string, ids, callback:(rates:number[])=>void) {
		var me = this;
		var now = new Date();
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		let todaysec = Math.round(today.getTime() / 1000);
		let b0 = todaysec;
		let b1 = b0 - 24 * 3600;
		let b2 = b1 - 24 * 3600;
		let b3 = b2 - 24 * 3600;
		let b4 = b3 - 24 * 3600;
		let b5 = b4 - 24 * 3600;
		let b6 = b5 - 24 * 3600;
		let b7 = b6 - 24 * 3600;
		let b8 = b7 - 24 * 3600;
		let b9 = b8 - 24 * 3600;
		let b10 = b9 - 24 * 3600;
		let b11 = b10 - 24 * 3600;

		var n_users:number[] = [];

		let alltimecount = {};
		alltimecount[ids._isUser] = true;
		alltimecount[ids._ctime] = {$lt: b11};
		db.collection(prefix + appid).count(alltimecount, function (err, res) {
			if (err) throw err;
			n_users.push(res);

			alltimecount[ids._ctime] = {$lt: b10};
			db.collection(prefix + appid).count(alltimecount, function (err, res) {
				if (err) throw err;
				n_users.push(res);
				alltimecount[ids._ctime] = {$lt: b9};
				db.collection(prefix + appid).count(alltimecount, function (err, res) {
					if (err) throw err;
					n_users.push(res);
					alltimecount[ids._ctime] = {$lt: b8};
					db.collection(prefix + appid).count(alltimecount, function (err, res) {
						if (err) throw err;
						n_users.push(res);
						alltimecount[ids._ctime] = {$lt: b7};
						db.collection(prefix + appid).count(alltimecount, function (err, res) {
							if (err) throw err;
							n_users.push(res);
							alltimecount[ids._ctime] = {$lt: b6};
							db.collection(prefix + appid).count(alltimecount, function (err, res) {
								if (err) throw err;
								n_users.push(res);
								alltimecount[ids._ctime] = {$lt: b5};
								db.collection(prefix + appid).count(alltimecount, function (err, res) {
									if (err) throw err;
									n_users.push(res);
									alltimecount[ids._ctime] = {$lt: b4};
									db.collection(prefix + appid).count(alltimecount, function (err, res) {
										if (err) throw err;
										n_users.push(res);
										alltimecount[ids._ctime] = {$lt: b3};
										db.collection(prefix + appid).count(alltimecount, function (err, res) {
											if (err) throw err;
											n_users.push(res);
											alltimecount[ids._ctime] = {$lt: b2};
											db.collection(prefix + appid).count(alltimecount, function (err, res) {
												if (err) throw err;
												n_users.push(res);
												alltimecount[ids._ctime] = {$lt: b1};
												db.collection(prefix + appid).count(alltimecount, function (err, res) {
													if (err) throw err;
													n_users.push(res);
													alltimecount[ids._ctime] = {$lt: b0};
													db.collection(prefix + appid).count(alltimecount, function (err, res) {
														if (err) throw err;
														n_users.push(res);
														alltimecount[ids._ctime] = {$gte: b0};
														db.collection(prefix + appid).count(alltimecount, function (err, res) {
															if (err) throw err;
															n_users.push(res);
															me.getUniqueVisitor(db, prefix, appid, ids, function (visitors) {
																for (var i = 0; i < 7; i++) {
																	var rates = [];

																	if (n_users[i - 6] == 0) {
																		rates.push(0);
																	}
																	else {
																		rates.push((visitors[i] - n_users[i]) / n_users[i - 6]);
																	}
																}
																callback(rates);
															});
														});
													});
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		});
	}

	private getConversionRate(db:mongo.Db, prefix:string, appid:string, ids, callback:(a:number) => void) {
		//3 retension rate = number of user purchase within 7 days/ total number of visitor
		//get alltime visitor

		var n_users:number[] = [];
		var n_users_purchase:number[] = [];

		var now = new Date();
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		let todaysec = Math.round(today.getTime() / 1000);
		let seventhdaybefore = todaysec - 7 * 24 * 3600;
		let b0 = todaysec;
		let b1 = b0 - 24 * 3600;
		let b2 = b1 - 24 * 3600;
		let b3 = b2 - 24 * 3600;
		let b4 = b3 - 24 * 3600;
		let b5 = b4 - 24 * 3600;
		let b6 = b5 - 24 * 3600;
		let b7 = b6 - 24 * 3600;
		let b8 = b7 - 24 * 3600;
		let b9 = b8 - 24 * 3600;
		let b10 = b9 - 24 * 3600;
		let b11 = b10 - 24 * 3600;
		let b12 = b11 - 24 * 3600;
		//let b13 = b12 - 24 * 3600;
		//let b14 = b13 - 24 * 3600;

		let alltimecount = {};
		alltimecount[ids._isUser] = {$exists: false};
		alltimecount[ids._ctime] = {$lt: b5};
		db.collection(prefix + appid).count(alltimecount, function (err, res) {
			if (err) throw err;
			n_users.push(res);
			alltimecount[ids._ctime] = {$lt: b4};
			db.collection(prefix + appid).count(alltimecount, function (err, res) {
				if (err) throw err;
				n_users.push(res);
				alltimecount[ids._ctime] = {$lt: b3};
				db.collection(prefix + appid).count(alltimecount, function (err, res) {
					if (err) throw err;
					n_users.push(res);
					alltimecount[ids._ctime] = {$lt: b2};
					db.collection(prefix + appid).count(alltimecount, function (err, res) {
						if (err) throw err;
						n_users.push(res);
						alltimecount[ids._ctime] = {$lt: b1};
						db.collection(prefix + appid).count(alltimecount, function (err, res) {
							if (err) throw err;
							n_users.push(res);
							alltimecount[ids._ctime] = {$lt: b0};
							db.collection(prefix + appid).count(alltimecount, function (err, res) {
								if (err) throw err;
								n_users.push(res);
								db.collection(prefix + appid).count(alltimecount, function (err, res) {
									if (err) throw err;
									n_users.push(res);

									// number of user purchase within 7 days of 7 days

									var retension_pipelines = [{$match: {}}, {$group: {_id: "$" + ids._mtid}}, {
										$group: {
											_id: null, count: {$sum: 1}
										}
									}];

									retension_pipelines[0]['$match'][ids._typeid] = "purchase";
									retension_pipelines[0]['$match'][ids._ctime] = {};
									retension_pipelines[0]['$match'][ids._ctime].$gte = b12;
									retension_pipelines[0]['$match'][ids._ctime].$lt = b5;
									db.collection(prefix + appid).aggregate(retension_pipelines, function (err, res) {
										if (err) throw err;
										n_users_purchase.push(res.length === 0 ? 0 : res[0].count);
										retension_pipelines[0]['$match'][ids._ctime].$gte = b11;
										retension_pipelines[0]['$match'][ids._ctime].$lt = b4;
										db.collection(prefix + appid).aggregate(retension_pipelines, function (err, res) {
											if (err) throw err;
											n_users_purchase.push(res.length === 0 ? 0 : res[0].count);
											retension_pipelines[0]['$match'][ids._ctime].$gte = b10;
											retension_pipelines[0]['$match'][ids._ctime].$lt = b3;
											db.collection(prefix + appid).aggregate(retension_pipelines, function (err, res) {
												if (err) throw err;
												n_users_purchase.push(res.length === 0 ? 0 : res[0].count);
												retension_pipelines[0]['$match'][ids._ctime].$gte = b9;
												retension_pipelines[0]['$match'][ids._ctime].$lt = b2;
												db.collection(prefix + appid).aggregate(retension_pipelines, function (err, res) {
													if (err) throw err;
													n_users_purchase.push(res.length === 0 ? 0 : res[0].count);
													retension_pipelines[0]['$match'][ids._ctime].$gte = b8;
													retension_pipelines[0]['$match'][ids._ctime].$lt = b1;
													db.collection(prefix + appid).aggregate(retension_pipelines, function (err, res) {
														if (err) throw err;
														n_users_purchase.push(res.length === 0 ? 0 : res[0].count);
														retension_pipelines[0]['$match'][ids._ctime].$gte = b7;
														retension_pipelines[0]['$match'][ids._ctime].$lt = b0;
														db.collection(prefix + appid).aggregate(retension_pipelines, function (err, res) {
															if (err) throw err;
															n_users_purchase.push(res.length === 0 ? 0 : res[0].count);
															retension_pipelines[0]['$match'][ids._ctime] = {};
															retension_pipelines[0]['$match'][ids._ctime].$gte = b6;
															db.collection(prefix + appid).aggregate(retension_pipelines, function (err, res) {
																if (err) throw err;
																n_users_purchase.push(res.length === 0 ? 0 : res[0].count);

																let retension_rates = [];
																for (let i = 0; i < 6; i++) {
																	retension_rates.push(n_users[i] === 0 ? 0 : n_users_purchase[i] / n_users[i]);
																}

																callback(retension_rates);
															});
														});
													});
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});

		});
	}

	public getMostPopulerCategory(db:mongo.Db, prefix:string, appid:string, ids, callback:(cat:string)=>void) {
		let lastweeksec = Math.round(new Date().getTime() / 1000) - 7 * 24 * 3600;
		let pipeline = [
			{$match: {}}, {
				$group: {
					_id: "$" + ids.cid,
					cname: {$first: "$" + ids.cname},
					revenue: {$sum: "$" + ids.amount}
				}
			}, {
				$sort: {revenue: -1}
			}, {
				$limit: 1
			}];

		pipeline[0]['$match'][ids._typeid] = 'purchase';
		pipeline[0]['$match'][ids._ctime] = {$gt: lastweeksec};

		db.collection(prefix + "app" + appid).aggregate(pipeline, function (err, res) {
			if (err) throw err;
			if (res.length == 0) return callback(undefined);
			return callback(res[0].cname);
		});
	}

	public getHighestRevenueCampaign(db:mongo.Db, prefix:string, appid:string, ids, callback:(cat:string)=>void) {
		let lastweeksec = Math.round(new Date().getTime() / 1000) - 7 * 24 * 3600;
		let pipeline = [
			{$match: {}}, {
				$group: {
					_id: "$" + ids._utm_campaign,
					revenue: {$sum: "$" + ids.amount}
				}
			}, {
				$sort: {revenue: -1}
			}, {
				$limit: 1
			}];

		pipeline[0]['$match'][ids._typeid] = 'purchase';
		pipeline[0]['$match'][ids._ctime] = {$gt: lastweeksec};
		pipeline[0]['$match'][ids._utm_campaign] = {$exists: true, $ne: null};
		db.collection(prefix + "app" + appid).aggregate(pipeline, function (err, res) {
			if (err) throw err;
			if (res.length == 0) return callback(undefined);
			return callback(res[0]._id);
		});
	}

	public getRevenuePerCustomer(db:mongo.Db, prefix:string, appid:string, ids, callback:(a:number)=>void) {
		let totaluserpipeline = [{$match: {}}, {$group: {_id: "$_" + ids._mtid}}, {
			$group: {
				_id: null,
				revenue: {$sum: "$" + ids.revenue}, count: {$sum: 1}
			}
		}];
		totaluserpipeline[0]['$match'][ids._isUser] = true;
		totaluserpipeline[0]['$match'][ids.signup] = true;

		db.collection(prefix + "app" + appid).aggregate(totaluserpipeline, function (err, res) {
			if (err) throw err;
			if (res.length == 0) return callback(0);
			return callback(res.revenue / res.count);
		});
	}

	public getMostEffectiveReferal(db: mongo.Db, prefix:string, appid:string, ids, callback:(ref:string)=>void){

	}

	public getDashboard(appid:string, callback:(d:DashboardEntity) => void) {
		let me = this;
		console.log('get dashboard');
		function generateDashboard(gcallback:(d:DashboardEntity) => void) {
			var dashboard:DashboardEntity = new DashboardEntity();
			me.converter.toIDs(["_isUser", "_mtid", "_ctime", "_typeid"], function (ids) {
				var now = new Date();
				var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

				let todaysec = Math.round(today.getTime() / 1000);
				let seventhdaybefore = todaysec - 7 * 24 * 3600;
				//1 number of new visitor today
				var todayvismatch = {};
				todayvismatch[ids._isUser] = {$exists: false};
				todayvismatch[ids._ctime] = {$gte: todaysec};

				var pipelines = [{$match: todayvismatch}, {$group: {_id: "$" + ids._mtid}}, {
					$group: {
						_id: null, count: {$sum: 1}
					}
				}];
				me.db.collection(me.prefix + "app" + appid).aggregate(pipelines, function (err, res) {
					if (err) throw err;
					if (res.length === 0)
						dashboard.n_returning_visitor = 0;
					else dashboard.n_returning_visitor = res[0].count;

					// 2 number of returning visitor
					todayvismatch[ids._isUser] = true;
					todayvismatch[ids._ctime] = {$gte: todaysec};

					me.db.collection(me.prefix + "app" + appid).count(todayvismatch, function (err, res) {
						if (err) throw err;
						dashboard.n_new_visitor = res;
						dashboard.n_returning_visitor -= res;

						me.getNewSignup(me.db, me.prefix, appid, ids, function (ret) {
							dashboard.n_new_signup = ret;

							me.getTotalRevenue(me.db, me.prefix, appid, ids, function (revenues, n_purchase) {
								dashboard.total_revenues = revenues;
								var sumrevnue = revenues.reduce((pv, cv) => pv + cv, 0);
								dashboard.n_avgcartsize = n_purchase == 0 ? sumrevnue : sumrevnue / n_purchase;
								gcallback(dashboard);

								me.getGrowRate(me.db, me.prefix, appid, ids, function (growrate:number) {
									dashboard.usergrowth_rate = growrate;
								});
								me.getConversionRate(me.db, me.prefix, appid, ids, function(cs:number) {
									dashboard.conversion_rate = cs;
									me.getRetensionRates(me.db, me.prefix, appid, ids, function (rates:number[]) {
										dashboard.retention_rates = rates;
										me.getRevenuePerCustomer(me.db, me.prefix, appid, ids, function (v:number) {
											dashboard.revenue_per_customer = v;

											me.getHighestRevenueCampaign(me.db, me.prefix, appid, ids, function(campaign: string){
												dashboard.highest_revenue_campaign = campaign;

												me.getMostPopulerCategory(me.db, me.prefix, appid, ids, function(cat:string){
													dashboard.most_popular_category = cat;

													me.getMostEffectiveReferal(me.db, me.prefix, appid, ids, function(ref: string){
														dashboard.most_effective_ref = ref;
														gcallback(d);
													});
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		}

		me.db.collection(me.prefix + "dashboard").find({appid: appid}).limit(1).toArray(function (err, res) {
			if (err) throw err;
			// cache not existed
			if (res.length === 0) {
				console.log('waiting lock 1');
				me.lock("c_" + appid, function (release) {
					console.log('getin lock 1');
					// recheck because cache could be create after the lock
					me.db.collection(me.prefix + "dashboard").find({appid: appid}).limit(1).toArray(function (err, res) {
						if (err) throw err;
						if (res.length === 0) {

							generateDashboard(function (dash:DashboardEntity) {
								callback(dash);
								dash.appid = appid + "";
								dash.ctime = Math.round(new Date().getTime() / 1000);
								me.db.collection(me.prefix + "dashboard").updateOne({appid: appid + ""}, dash, {upsert: true}, function (err) {
									release()();
									if (err) throw err;
								});
							});
						} else {
							return release(function () {
								// why not just do callback(res[0]) ?
								// this may look wasted, but give us 100% guarranty that,
								// the result dashboard alway up to date
								// the problem with res[0] is that, is very likely up to date
								// (deltatime < delay) but there is no warranty
								me.getDashboard(appid, callback);
							})();
						}
					});
				});
				return;
			}

			var dash = res[0];
			var deltaT = Math.round(new Date().getTime() / 1000) - dash.ctime;

			if (deltaT > me.delaysec) {
				console.log('lock 2');
				me.lock("c_" + appid, function (release) {
					console.log('getin lock 2');
					me.db.collection(me.prefix + "dashboard").find({appid: appid}).limit(1).toArray(function (err, res) {
						if (err) throw err;
						// this is a must found
						var dash = res[0];
						var deltaT = Math.round(new Date().getTime() / 1000) - dash.ctime;
						if (deltaT > me.delaysec) {
							// refresh the cache
							generateDashboard(function (dash:DashboardEntity) {
								callback(dash);
								dash.appid = appid + "";
								dash.ctime = Math.round(new Date().getTime() / 1000);
								me.db.collection(me.prefix + "dashboard").updateOne({appid: appid + ""}, dash, {upsert: true}, function (err) {
									release(function () {
									})();
									if (err) throw err;
								});
							});
						} else
							return release(function () {
								// callback(dash);
								// again, why not use callback(dash) ? because i want 100% guarranty that the dash
								// is up to date (deltatime < delay)
								me.getDashboard(appid, callback);
							})();
					});
				});
			} else {
				callback(dash);
			}
		});
	}
}
