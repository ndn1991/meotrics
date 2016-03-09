'use strict'
var config = require('config')
var redis = require("redis")


//will call callback after call done() for n times
exports.IdManager = function () {
var me = this;
function zip(number)
{
  return toRadix(number, 61);
}

function unzip(string)
{
  return fromRadix(string, 61);
}

  function fromRadix(v, radix)
  {
    var digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    function ZdigitToInt(ch)
    {
      for (var i = 0;  i < digits.length;  i++)
        if (ch == digits.charAt(i))
          return (i - 0);
      return 0;
    }

      // Parse input value
      var sign = v.substr(0, 1);
      if (sign == "+"  ||  sign == "-")
        v = v.substr(1);
      else
        sign = "";

      // Convert the input value to a number in the input base
      var r = 0;
      while (v != "")
      {
          var d = v.substr(0, 1);
          d = ZdigitToInt(d);
          v = v.substr(1);
          r = r*radix + d;
      }
      v = r;

      // Convert the number to the output base
      r = "";
      do
      {
          var d = Math.round(v%10, 0);
          v = Math.round((v - d)/10, 0);
          r = digits.charAt(d) + r;
      } while (v > 0);
      r = sign + r;
      return r;
  }

  function toRadix(N,radix) {
 var HexN="", Q=Math.floor(Math.abs(N)), R;
 while (true) {
  R=Q%radix;
  HexN = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".charAt(R)
       + HexN;
  Q=(Q-R)/radix;
  if (Q==0) break;
 }
 return ((N<0) ? "-"+HexN : HexN);
}

  function fromRadix(S, radis)
  {

  }

  var    db = redis.createClient(  config.get('redis.port'),config.get('redis.host'));
  db.auth(config.get('redis.password'), function(){  });

  var initcallbacks=[];

  var lastid = undefined;
  function newID(callback)
  {
      var retval = 0;
    if(lastid == undefined)
    {
        db.get('lastid', function(err, value){

          if(err) throw err;
          if(value == null) value = 1;
          if(lastid!== undefined)
            return newID(callback);
          lastid = value;
          return newID(callback);
        });
    }
    else {
      lastid++;
      db.set('lastid', lastid);
      callback(lastid);
      }
  }

  this.toID = function(name)
  {
    var defname = name;
    var sucback;
    var errback;
    var p = new Promise( function(resolve, reject){
      sucback = resolve;
      errback = reject;
    });


    // escape case
    if(name == '_id')
    {
      (function(){sucback(name)})();

    }
    else {
      if( name.startsWith("$") )
        name = (name.substring(1));

      db.get(name, function(err, value){

        //name doesn't exist yet
        if(value == null){
          newID(function(newid){
            db.set(newid, name  );
            db.set(name, newid);
            if( name.startsWith("$") )
              sucback('$' + zip(newid));
            sucback(zip(newid));
          });
        }
        else {
          sucback(zip(value));
          if( name.startsWith("$") )
            sucback('$' + zip(value));
          sucback(zip(value));
        }

      });
    }

    return p;


  }


  this.toObject = function( object)
  {
    var sucback;
    var errback;
    var p = new Promise( function(resolve, reject){
      sucback = resolve;
      errback = reject;
    });


    var newobj = {};
    var ci = 0;
    for(let i in object)
    {
      ci++;
      me.toID(i).then(function(value){
        newobj[value] = object[i];
        ci--;
        if(ci == 0) return sucback(newobj);
      });
    }
    return p;
  }

}
