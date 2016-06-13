"use strict";
class DashboardEntity {
}
exports.DashboardEntity = DashboardEntity;
class Dashboard {
    constructor(db, converter, prefix, ref, delaysec) {
        this.db = db;
        this.converter = converter;
        this.prefix = prefix;
        this.ref = ref;
        this.delaysec = delaysec;
        this.Lock = require('lock');
        this.lock = this.Lock();
        this.N = 22; //max number of node
    }
    //get time scale between two date
    getTimeRange(starttime, endtime) {
        if (endtime < starttime)
            throw "wrong time input";
        var me = this;
        var ret = [];
        var daydiff = Math.floor((endtime - starttime) / 86400);
        if (daydiff == 0)
            return [endtime - 86400, endtime];
        if (daydiff == 1)
            return [starttime, endtime];
        // if not enough day for node, then return all day
        if (daydiff < me.N) {
            ret.push(starttime);
            var st = starttime;
            while (st < endtime) {
                st += 86400;
                ret.push(st);
            }
            ret.push(endtime);
            return ret;
        }
        // return specific days in all day
        // arary alway start with starttime and end with endtime
        var d = Math.ceil((daydiff - 2) / (me.N - 2));
        ret.push(starttime);
        for (var i = 1; i < me.N - 1; i++)
            ret.push(starttime + i * d * 86400);
        ret.push(endtime);
        return ret;
    }
    getNewSignup(db, prefix, appid, ids, callback) {
        var now = new Date();
        var nowsec = Math.round(new Date().getTime() / 1000);
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let todaysec = Math.round(today.getTime() / 1000);
        let me = this;
        let match = {};
        match[ids._ctime] = { $gte: todaysec };
        match[ids._typeid] = 'signup';
        match[ids._isUser] = { $exists: false };
        db.collection(prefix + "app" + appid).count(match, function (err, res) {
            if (err)
                throw err;
            callback(res);
        });
    }
    getGrowthRate(db, prefix, appid, ids, time, callback) {
        var now = new Date(time * 1000);
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let todaysec = Math.round(today.getTime() / 1000);
        var pipeline = [{ $match: {} }, { $group: { _id: "$" + ids._mtid } }, {
                $group: {
                    _id: null, count: { $sum: 1 }
                }
            }];
        //count unique today visitor
        pipeline[0]['$match'][ids._ctime] = { $gte: todaysec, $lt: todaysec + 86400 };
        pipeline[0]['$match'][ids._isUser] = { $exists: false };
        db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
            if (err)
                throw err;
            if (res.length == 0)
                return callback(0);
            else {
                let todayvisitcount = res[0].count;
                //count yesterday unique visitor
                pipeline[0]['$match'][ids._ctime] = { $gte: todaysec - 86400, $lt: todaysec };
                db.collection(prefix + appid).aggregate(pipeline, function (err, res) {
                    if (err)
                        throw err;
                    if (res.length == 0)
                        return callback(todayvisitcount);
                    return callback(1.0 * todayvisitcount - res[0].count / res[0].count * 100);
                });
            }
        });
    }
    getGrowthRates(db, prefix, appid, ids, startime, endtime, callback) {
        let me = this;
        var rates = [];
        var time = me.getTimeRange(startime, endtime);
        var c = time.length;
        for (let i = 0; i < time.length; i++) {
            me.getGrowthRate(db, prefix, appid, ids, i, function (rate) {
                c--;
                rates[i] = rate;
                if (c == 0) {
                    callback(rates);
                }
            });
        }
    }
    getTotalRevenue(db, prefix, appid, ids, starttime, endttime, callback) {
        var now = new Date(starttime * 1000);
        var startday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        now = new Date(endttime * 1000);
        var endday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startsec = Math.round(startday.getTime() / 1000);
        let endsec = Math.round(endday.getTime() / 1000) + 86400;
        var revenue_pipeline = [{ $match: {} }, {
                $group: {
                    _id: "$" + ids._mtid, sum: { $sum: "$" + ids.amount }, purchase: { $sum: 1 }
                }
            }, {
                $group: {
                    _id: null, sum: { $sum: "$sum" }, count: { $sum: 1 }, npurchase: { $sum: "$purchase" }
                }
            }];
        revenue_pipeline[0]['$match'][ids._isUser] = { $exists: false };
        revenue_pipeline[0]['$match'][ids._typeid] = "purchase";
        revenue_pipeline[0]['$match'][ids._ctime] = { $gte: startsec, $lt: endsec };
        db.collection(prefix + appid).aggregate(revenue_pipeline, function (err, res) {
            if (err)
                throw err;
            var revenue = res.length === 0 ? 0 : res[0].sum;
            var nuser = res.length === 0 ? 0 : res[0].count;
            var npurchase = res.length === 0 ? 0 : res[0].npurchase;
            callback(revenue, npurchase, nuser);
        });
    }
    getRevenue(db, prefix, appid, ids, time, callback) {
        var now = new Date(time * 1000);
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let todaysec = Math.round(today.getTime() / 1000);
        let seventhdaybefore = todaysec - 7 * 24 * 3600;
        var revenue_pipeline = [{ $match: {} }, {
                $group: {
                    _id: null, sum: { $sum: "$" + ids.amount }, count: { $sum: 1 }
                }
            }];
        revenue_pipeline[0]['$match'][ids._isUser] = { $exists: false };
        revenue_pipeline[0]['$match'][ids._typeid] = "purchase";
        revenue_pipeline[0]['$match'][ids._ctime] = { $gte: todaysec, $lt: todaysec + 86000 };
        db.collection(prefix + appid).aggregate(revenue_pipeline, function (err, res) {
            if (err)
                throw err;
            var revenue = res.length === 0 ? 0 : res[0].sum;
            var n_purchase = res.length === 0 ? 0 : res[0].count;
            callback(revenue, n_purchase);
        });
    }
    getRevenues(db, prefix, appid, ids, starttime, endtime, callback) {
        let me = this;
        var revenues = [];
        var purchases = [];
        var time = me.getTimeRange(starttime, endtime);
        var c = time.length;
        for (let i = 0; i < time.length; i++) {
            me.getRevenue(db, prefix, appid, ids, i, function (revenue, purchase) {
                c--;
                revenues[i] = revenue;
                purchases[i] = purchase;
                if (c == 0) {
                    callback(revenues, purchases);
                }
            });
        }
    }
    getRetensionRate(db, prefix, appid, ids, callback) {
        var me = this;
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let todaysec = Math.round(today.getTime() / 1000);
        let b6 = todaysec - 24 * 6 * 3600;
        var n_newuser, n6_user;
        let alltimecount = {};
        alltimecount[ids._isUser] = true;
        alltimecount[ids._ctime] = { $lt: b6 };
        db.collection(prefix + appid).count(alltimecount, function (err, res) {
            if (err)
                throw err;
            n6_user = res;
            alltimecount[ids._ctime] = { $gte: b6 };
            db.collection(prefix + appid).count(alltimecount, function (err, res) {
                if (err)
                    throw err;
                n_newuser = res;
                //get today user visit
                var todayuservisitq = [{}, {}, {}, {}, {}];
                todayuservisitq[0]['$match'] = { $or: [{}, {}] };
                todayuservisitq[0]['$match']['$or'][0][ids._isUser] = true;
                todayuservisitq[0]['$match']['$or'][1][ids._isUser] = { $exists: false };
                todayuservisitq[0]['$match']['$or'][1][ids._ctime] = { $gte: todaysec };
                todayuservisitq[1]['$project'] = {};
                todayuservisitq[1]['$project'][ids._mtid] = 1;
                todayuservisitq[1]['$project'][ids.userid] = { $cond: { if: { $ifNull: ["$userid", false] }, then: 1, else: 0 } };
                todayuservisitq[2]['$group'] = { _id: "$" + ids._mtid, userid: { $sum: "$" + ids.userid }, count: { $sum: 1 } };
                todayuservisitq[3]['$match'] = { userid: { $gt: 0 }, count: { $gt: 1 } };
                todayuservisitq[4]['$group'] = { _id: null, count: { $sum: 1 } };
                //console.log("todayuservisitq", JSON.stringify(todayuservisitq));
                me.db.collection(me.prefix + "app" + appid).aggregate(todayuservisitq, function (err, res) {
                    if (err)
                        throw err;
                    var count = 0;
                    if (res.length !== 0)
                        count = res[0].count;
                    var rate = (count - n_newuser) / n6_user;
                    callback(rate);
                });
            });
        });
    }
    getConversionRate(db, prefix, appid, ids, starttime, endtime, callback) {
        var now = new Date(starttime * 1000);
        var startday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        now = new Date(endtime * 1000);
        var endday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startsec = Math.round(startday.getTime() / 1000);
        let endsec = Math.round(endday.getTime() / 1000) + 86400;
        let allvisitor = {};
        allvisitor[ids._isUser] = { $exists: false };
        allvisitor[ids._ctime] = { $gte: startsec, $lt: endsec };
        var piplelines = [{ $match: allvisitor }, { $group: { _id: "$" + ids._mtid } }, { $group: { _id: null, count: { $sum: 1 } } }];
        //get unique visitor
        db.collection(prefix + appid).aggregate(piplelines, function (err, res) {
            if (err)
                throw err;
            var nuservisit = res.length === 0 ? 0 : res[0].count;
            piplelines[0]['$match'] = {};
            piplelines[0]['$match'][ids._typeid] = "purchase";
            piplelines[0]['$match'][ids._isUser] = { $exists: false };
            piplelines[0]['$match'][ids._ctime] = { $gte: startsec, $lt: endsec };
            db.collection(prefix + appid).aggregate(piplelines, function (err, res) {
                if (err)
                    throw err;
                var nuserpurchase = res.length === 0 ? 0 : res[0].count;
                var conversionrate = nuservisit == 0 ? 0 : nuserpurchase / nuservisit;
                callback(conversionrate);
            });
        });
    }
    getMostPopulerCategory(db, prefix, appid, ids, starttime, endtime, callback) {
        var now = new Date(starttime * 1000);
        var startday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        now = new Date(endtime * 1000);
        var endday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startsec = Math.round(startday.getTime() / 1000);
        let endsec = Math.round(endday.getTime() / 1000) + 86400;
        let pipeline = [
            { $match: {} }, {
                $group: {
                    _id: "$" + ids.cid,
                    cname: { $first: "$" + ids.cname },
                    revenue: { $sum: "$" + ids.amount }
                }
            }, {
                $sort: { revenue: -1 }
            }, {
                $limit: 1
            }];
        pipeline[0]['$match'][ids._typeid] = 'purchase';
        pipeline[0]['$match'][ids._ctime] = { $gte: startsec, $lt: endsec };
        db.collection(prefix + "app" + appid).aggregate(pipeline, function (err, res) {
            if (err)
                throw err;
            if (res.length == 0)
                return callback(undefined);
            return callback(res[0].cname);
        });
    }
    getHighestRevenueCampaign(db, prefix, appid, ids, starttime, endtime, callback) {
        var now = new Date(starttime * 1000);
        var startday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        now = new Date(endtime * 1000);
        var endday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startsec = Math.round(startday.getTime() / 1000);
        let endsec = Math.round(endday.getTime() / 1000) + 86400;
        let pipeline = [
            { $match: {} }, {
                $group: {
                    _id: "$" + ids._utm_campaign,
                    revenue: { $sum: "$" + ids.amount }
                }
            }, {
                $sort: { revenue: -1 }
            }, {
                $limit: 1
            }];
        pipeline[0]['$match'][ids._typeid] = 'purchase';
        pipeline[0]['$match'][ids._ctime] = { $gte: startsec, $lt: endsec };
        pipeline[0]['$match'][ids._utm_campaign] = { $exists: true, $ne: null };
        db.collection(prefix + "app" + appid).aggregate(pipeline, function (err, res) {
            if (err)
                throw err;
            if (res.length == 0)
                return callback(undefined);
            return callback(res[0]._id);
        });
    }
    getRevenuePerCustomer(db, prefix, appid, ids, callback) {
        let totaluserpipeline = [{ $match: {} }, { $group: { _id: "$_" + ids._mtid } }, {
                $group: {
                    _id: null,
                    revenue: { $sum: "$" + ids.revenue }, count: { $sum: 1 }
                }
            }];
        totaluserpipeline[0]['$match'][ids._isUser] = true;
        totaluserpipeline[0]['$match'][ids.signup] = true;
        db.collection(prefix + "app" + appid).aggregate(totaluserpipeline, function (err, res) {
            if (err)
                throw err;
            if (res.length == 0)
                return callback(0);
            return callback(res.revenue / res.count);
        });
    }
    getMostEffectiveReferal(db, prefix, appid, ids, starttime, endtime, callback) {
        var me = this;
        var now = new Date(starttime * 1000);
        var startday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        now = new Date(endtime * 1000);
        var endday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startsec = Math.round(startday.getTime() / 1000);
        let endsec = Math.round(endday.getTime() / 1000) + 86400;
        let pipeline = [
            { $match: {} }, {
                $group: {
                    _id: "$" + ids._reftype,
                    count: { $sum: 1 }
                }
            }, {
                $sort: { count: -1 }
            }, {
                $limit: 1
            }];
        pipeline[0]['$match'][ids._typeid] = 'pageview';
        pipeline[0]['$match'][ids._ctime] = { $gte: startsec, $lt: endsec };
        db.collection(prefix + "app" + appid).aggregate(pipeline, function (err, res) {
            if (err)
                throw err;
            if (res.length == 0)
                return callback(undefined);
            return callback(me.ref.getTypeName(res[0]._id));
        });
    }
    generateLabel(startime, endtime) {
        var labels = [];
        var ranges = this.getTimeRange(startime, endtime);
        for (var i of ranges) {
            var date = new Date(i * 1000);
            labels.push(date.getMonth() + 1 + "-" + date.getDate());
        }
        return labels;
    }
    getDashboard(appid, startime, endtime, callback) {
        let me = this;
        if (startime === undefined) {
            endtime = Math.floor(new Date().getTime() / 1000);
            startime = endtime - 30 * 86400;
        }
        var now = new Date(startime * 1000);
        var startday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        now = new Date(endtime * 1000);
        var endday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startsec = Math.round(startday.getTime() / 1000);
        let endsec = Math.round(endday.getTime() / 1000) + 86400;
        function generateDashboard(gcallback) {
            var dashboard = new DashboardEntity();
            dashboard.labels = me.generateLabel(startime, endtime);
            me.converter.toIDs(["_isUser", "_mtid", "_ctime", "_typeid", "_reftype", "userid", "cname", "amount", "cid"], function (ids) {
                var now = new Date();
                var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                let todaysec = Math.round(today.getTime() / 1000);
                let seventhdaybefore = todaysec - 7 * 24 * 3600;
                //1 number of new visitor today
                var todayvismatch = {};
                todayvismatch[ids._ctime] = { $gte: todaysec };
                var pipelines = [{ $match: todayvismatch }, { $group: { _id: "$" + ids._mtid } }, {
                        $group: {
                            _id: null, count: { $sum: 1 }
                        }
                    }];
                me.db.collection(me.prefix + "app" + appid).aggregate(pipelines, function (err, res) {
                    if (err)
                        throw err;
                    if (res.length === 0)
                        dashboard.n_returning_visitor = 0;
                    else
                        dashboard.n_returning_visitor = res[0].count;
                    // 2 number of returning visitor
                    todayvismatch[ids._isUser] = true;
                    todayvismatch[ids._ctime] = { $gte: todaysec };
                    me.db.collection(me.prefix + "app" + appid).count(todayvismatch, function (err, res) {
                        if (err)
                            throw err;
                        dashboard.n_new_visitor = res;
                        dashboard.n_returning_visitor -= res;
                        me.getNewSignup(me.db, me.prefix, appid, ids, function (ret) {
                            dashboard.n_new_signup = ret;
                            me.getRevenues(me.db, me.prefix, appid, ids, startime, endtime, function (revenues, n_purchases) {
                                dashboard.revenues = revenues;
                                dashboard.n_purchases = n_purchases;
                                me.getTotalRevenue(me.db, me.prefix, appid, ids, startime, endtime, function (revenue, npurchase, nuser) {
                                    dashboard.total_revenue = revenue;
                                    dashboard.n_avgcartsize = npurchase === 0 ? 0 : revenue / npurchase;
                                    dashboard.revenue_per_customer = nuser === 0 ? 0 : revenue / nuser;
                                    me.getGrowthRates(me.db, me.prefix, appid, ids, startime, endtime, function (growrates) {
                                        dashboard.usergrowth_rates = growrates;
                                        me.getConversionRate(me.db, me.prefix, appid, ids, startime, endtime, function (cs) {
                                            dashboard.conversion_rate = cs;
                                            me.getRetensionRate(me.db, me.prefix, appid, ids, function (rate) {
                                                dashboard.retention_rate = rate;
                                                me.getHighestRevenueCampaign(me.db, me.prefix, appid, ids, startime, endtime, function (campaign) {
                                                    dashboard.highest_revenue_campaign = campaign;
                                                    me.getMostPopulerCategory(me.db, me.prefix, appid, ids, startime, endtime, function (cat) {
                                                        dashboard.most_popular_category = cat;
                                                        me.getMostEffectiveReferal(me.db, me.prefix, appid, ids, startime, endtime, function (ref) {
                                                            dashboard.most_effective_ref = ref;
                                                            gcallback(dashboard);
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
        me.db.collection(me.prefix + "dashboard").find({ appid: appid, endtime: endsec, starttime: startsec }).limit(1).toArray(function (err, res) {
            if (err)
                throw err;
            // cache not existed
            if (res.length === 0) {
                me.lock("c_" + appid + "-" + startsec + "-" + endsec, function (release) {
                    // recheck because cache could be create after the lock
                    me.db.collection(me.prefix + "dashboard").find({ appid: appid, endtime: endsec, starttime: startsec }).limit(1).toArray(function (err, res) {
                        if (err)
                            throw err;
                        if (res.length === 0) {
                            generateDashboard(function (dash) {
                                callback(dash);
                                dash.appid = appid + "";
                                dash.ctime = Math.round(new Date().getTime() / 1000);
                                me.db.collection(me.prefix + "dashboard").updateOne({ appid: appid + "", endtime: endsec, starttime: startsec }, dash, { upsert: true }, function (err) {
                                    release()();
                                    if (err)
                                        throw err;
                                });
                            });
                        }
                        else {
                            return release(function () {
                                // why not just do callback(res[0]) ?
                                // this may look wasted, but give us 100% guarranty that,
                                // the result dashboard alway up to date
                                // the problem with res[0] is that, is very likely up to date
                                // (deltatime < delay) but there is no warranty
                                me.getDashboard(appid, startime, endtime, callback);
                            })();
                        }
                    });
                });
                return;
            }
            var dash = res[0];
            var deltaT = Math.round(new Date().getTime() / 1000) - dash.ctime;
            if (deltaT > me.delaysec) {
                me.lock("c_" + appid + "-" + startsec + "-" + endsec, function (release) {
                    me.db.collection(me.prefix + "dashboard").find({ appid: appid, endtime: endsec, starttime: startsec }).limit(1).toArray(function (err, res) {
                        if (err)
                            throw err;
                        // this is a must found
                        var dash = res[0];
                        var deltaT = Math.round(new Date().getTime() / 1000) - dash.ctime;
                        if (deltaT > me.delaysec) {
                            // refresh the cache
                            generateDashboard(function (dash) {
                                callback(dash);
                                dash.appid = appid + "";
                                dash.ctime = Math.round(new Date().getTime() / 1000);
                                me.db.collection(me.prefix + "dashboard").updateOne({ appid: appid + "", endtime: endsec, starttime: startsec }, dash, { upsert: true }, function (err) {
                                    release(function () {
                                    })();
                                    if (err)
                                        throw err;
                                });
                            });
                        }
                        else
                            return release(function () {
                                // callback(dash);
                                // again, why not use callback(dash) ? because i want 100% guarranty that the dash
                                // is up to date (deltatime < delay)
                                me.getDashboard(appid, startime, endtime, callback);
                            })();
                    });
                });
            }
            else {
                callback(dash);
            }
        });
    }
}
exports.Dashboard = Dashboard;
//# sourceMappingURL=dashboard.js.map