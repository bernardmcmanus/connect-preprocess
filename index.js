module.exports = function( options ) {

  'use strict';

  var mime = require( 'mime' );
  var extend = require( 'extend' );

  function $Defaults() {
    return {
      accept: [ 'html' , 'css' , 'js' ],
      engine: function( string ) { return string }
    };
  }
  
  var $preprocessor = extend( $Defaults() , options , {
    _accepts: function( req , res ) {
      var content_type = res._headers ? (res._headers['content-type'] || '').split( ';' )[0] : null;
      var ext = content_type ? mime.extension( content_type ) : req.url.match( /(\.\w+)\??.*$/ );
      return res.statusCode == 200 && this.accept.indexOf( ext ) >= 0;
    }
  });

  return function( req , res , next ) {

    if (res.__preprocess) {
      return next();
    }

    res.__preprocess = true;

    var writeHead = res.writeHead;
    var write = res.write;
    var end = res.end;

    function restore() {
      res.writeHead = writeHead;
      res.write = write;
      res.end = end;
    }

    res.push = function( chunk ) {
      res.data = (res.data || '') + chunk;
    };

    res.writeHead = function(){};

    res.write = function( string , encoding ) {
      encoding = encoding || 'utf-8';
      if (string !== undefined) {
        var body = (Buffer.isBuffer( string ) ? string.toString( encoding ) : string);
        if (res._headers && $preprocessor._accepts( req , res )) {
          res.push( body );
        }
        else {
          restore();
          return write.call( res , string , encoding );
        }
      }
    };

    res.end = function( string , encoding ) {
      restore();
      encoding = encoding || 'utf-8';
      if (res.data && $preprocessor._accepts( req , res )) {
        string = $preprocessor.engine( res.data );
        if (res.data !== undefined && !res._header) {
          res.setHeader( 'Content-Length' , Buffer.byteLength( string , encoding ));
        }
        res.data = '';
      }
      res.end( string , encoding );
    };

    next();
  };
};
