"use strict";

var trycatch = require('trycatch');
var qs = require('querystring');
var url = require('url');
var fs = require('fs');
var ua = require('ua-parser');
var MD = require('mobile-detect');
var ActionMgr = require('./actionmgr');
exports.HttpApi = function (db, converter, prefix, codepath, ref, valuemgr) {
	var code;
	var actionmgr = new ActionMgr.ActionMgr(db, converter, prefix, "mapping", valuemgr, ref);
	var me = this;
	this.onchange = function () { };
	function loadCode(appid, actionid, callback) {
		// cache mtcode in code for minimize disk usage, lazy load
		if (code === undefined) {
			fs.readFile(codepath, 'ascii', function (err, data) {
				code = data;
				replaceParam();
			});
		}
		else replaceParam();

		function replaceParam() {
			callback(code.replace('$APPID$', appid).replace('$ACTIONID$', actionid));
		}
	}

	// purpose get real ip address
	function getRemoteAddress(req) {
		return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
	}

	// purpose: extract basic info from user agent and request parameter
	function trackBasic(request) {
		var useragent = request.headers['user-agent'];
		var r = ua.parse(useragent);
		var uri = request.params._url || '';
		var md = new MD(useragent);
		var devicetype;
		if (md.tablet() !== null)
			devicetype = 'tablet';
		else if (md.phone() !== null)
			devicetype = 'phone';
		else
			devicetype = 'desktop';
		if (uri === "" || uri.startsWith(request.headers.referer) === false) uri = request.headers.referer || '';
		var res = {
			_url: uri,
			_callback : request.params._callback,
			_ref: request.params._ref,
			_typeid: request.params._typeid,
			_ip: getRemoteAddress(request),
			_deltat: request.params._deltat,
			_os: r.os.family,
			_browser: r.ua.family,
			_browserver: r.ua.major + '.' + r.ua.minor,
			_osver: r.os.major + '.' + r.os.minor,
			_deviceid: r.device.family,
			_scr: request.params._scr,
			_lang: request.headers["accept-language"],
			_devicetype: devicetype
		};

		for (var i in request.params)
			// if (request.params.hasOwnProperty(i))
			if (i.startsWith('_') === false)
				res[i] = isNaN(request.params[i]) ? request.params[i] : parseFloat(request.params[i]);

		// extract campaign
		var query = url.parse(uri, true).query;
		res._utm_source = query.utm_source;
		res._utm_campaign = query.utm_campaign;
		res._utm_term = query.utm_term;
		res._utm_content = query.utm_content;
		res._utm_medium = query.utm_medium;

		return res;
	}

	function getMtid(req, appid, res, callback) {
		var mtid = getCookie(req, "mtid");
		if (mtid === undefined) {
			mtid = req.params._mtid;
			if (mtid === undefined) {
				return actionmgr.setupRaw(appid, function (mtid) {
					setCookie(res, "mtid", mtid, appid);
					callback(mtid);
				});
			}
		}

		// check if mtid is valid
		actionmgr.ismtidValid(appid, mtid, function (ret) {
			if (ret) callback(mtid);
			else {
				eraseCookie(res, "mtid", appid);
				actionmgr.setupRaw(appid, function (mtid) {
					setCookie(res, "mtid", mtid, appid);
					callback(mtid);
				});
			}
		});
	}

	function eraseCookie(res, name, path) {
		res.setHeader('Set-Cookie', name + "=x; expires=Wed, 21 Aug 1995 11:11:11 GMT; path=/" + path);
	}

	function clear(req, res) {
		// delete the cookie
		eraseCookie(res, 'mtid', req.appid);
		res.end();
	}

	function track(req, res) {
		var appid = req.appid;
		var data = trackBasic(req);
		var callback = (data._callback == 'true' || data._callback == true);
		delete data._callback;

		getMtid(req, appid, res, function (mtid) {
			data._mtid = mtid;
			actionmgr.saveRaw(appid, data, function (actionid) {
				me.onchange(appid, "type." + data._typeid);
				
				if (callback === true)
				{
					res.setHeader('Content-Type', 'application/javascript');
					res.end("mt.actionid = \"" + mtid + "\";");
				}
				else {
					res.setHeader('Content-Type', 'text/plain');
					res.end("\"" + mtid + "\"");
				}
	
			});
		});
	}

	// identify an user
	// if mtid not exists in the parameter ->create one
	function info(req, res) {
		var appid = req.appid;
		getMtid(req, appid, res, function (mtid) {
			var data = {};
			for (var i in req.params) if (req.params.hasOwnProperty(i))
				if (i.startsWith('_') === false) data[i] = isNaN(req.params[i]) ? req.params[i] : parseFloat(req.params[i]);

			actionmgr.identifyRaw(appid, { mtid: mtid, user: data }, function (mtid) {
				//set new mtid if need
				setCookie(res, "mtid", mtid, appid);
				res.setHeader('Content-Type', 'text/plain');

				res.end("\"" + mtid + "\"");
			});
		});
	}

	function x(req, res) {
		actionmgr.x(req, res, function () {
		});
	}

	function getCookie(req, name) {
		var list = {}, rc = req.headers.cookie;
		rc && rc.split(';').forEach(function (cookie) {
			var parts = cookie.split('=');
			list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
		});
		return list[name];
	}

	function setCookie(res, name, value, path) {
		var tenyearlater = new Date().getYear() + 10 + 1900;
		res.setHeader('Set-Cookie', name + '=' + encodeURIComponent(value) + "; expires=Wed, 21 Aug " + tenyearlater + " 11:11:11 GMT; path=/" + path);
	}

	function fix(req, res) {
		var appid = req.appid;
		var actionid = req.actionid;
		var lastactionid = req.lastactionid;
		var data = trackBasic(req);
		getMtid(req, appid, res, function (mtid) {
			data._mtid = mtid;
			actionmgr.fixRaw(appid, actionid, lastactionid, data, function () {
				res.end();
			});
		});
	}

	function suggest(req, res) {
		valuemgr.suggest(req.appid + "", req.typeid + "", req.field + "", req.qr + "", function (results) {
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Access-Control-Allow-Origin', '*');
			//res.setHeader('Access-Control-Allow-Origin', 'https://app.meotrics.com env=HTTPS');

			res.setHeader('Access-Control-Allow-Methods', 'GET');
			res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
			res.setHeader('Access-Control-Allow-Credentials', true);
			res.end(JSON.stringify(results));
		});
	}

	function pageview(req, res) {
		var appid = req.appid;
		// record an new pageview
		var data = trackBasic(req);
		getMtid(req, appid, res, function (mtid) {
			data._mtid = mtid;
			data._typeid = 'pageview';

			actionmgr.saveRaw(appid, data, function (actionid) {
				me.onchange(appid, 'type.pageview');
				// return code
				loadCode(appid, actionid, function (code) {
					res.setHeader('Content-Type', 'text/css');
					res.end(code);
				});
			});
		});
	}

	this.route = function (req, res) {
		var me = this;
		trycatch(function () {
			var url_parts = url.parse(req.url, true);
			if (req.method === 'POST') {
				var body = '';
				req.on('data', function (data) {
					body += data;
				});
				req.on('end', function () {
					req['params'] = qs.parse(body);
					handle(req, res, url_parts.pathname);
				});
			}
			else if (req.method === 'GET') {
				req['params'] = url_parts.query;
				handle(req, res, url_parts.pathname);
			}

			function handle(req, res, path) {
				var parts = path.split('/');
				res.statusCode = 200;
				req['appid'] = parts[1];
				var action = parts[2];
				if (action === 'track') track(req, res);
				else if (action === '' || action === undefined) pageview(req, res);
				else if (action === 'clear') clear(req, res);
				else if (action === 'info') info(req, res);
				else if (action === 'x') {
					req['actionid'] = parts[3];
				
					x(req, res);
				}
				else if (action === 'suggest') {
					req['typeid'] = parts[3];
					req['field'] = parts[4];
					req['qr'] = parts[5];
					suggest(req, res);
				}
				else if (action === 'fix') {
					var query = url.parse(path, true).query;
					req['actionid'] = req.params.actionid;
					req['lastactionid'] = req.params.lastactionid;
						if(req.params.actionid==null) console.log('errfix: ', path);
					fix(req, res);
				} else {
					res.statusCode = 404;
					res.end('action "' + action + '" not found, action must be one of [x, clear, info, fix, track]');
				}
			}
		}, function (err) {
			res.statusCode = 500;
			res.end();
			console.log(err, err.stack);
		});
	};
};
