module.exports = function( options ){

  'use strict';

  var Q = require( 'q' );
  var url = require( 'url' );
  var path = require( 'path' );
  var fs = require( 'fs-extra' );
  var extend = require( 'extend' );
  var resolvePath = require( 'resolve-path' );

  var $preprocessor = (function() {
    var defaults = {
      root: process.cwd(),
      chain: false,
      index: 'index.html',
      accept: [ 'html' , 'css' , 'js' ],
      engine: function( string ) { return string }
    };
    return extend( defaults , options , {
      _accepts: function( fpath ){
        var match = fpath.match( /\.(\w+)$/ );
        return match ? $preprocessor.accept.indexOf( match[1] ) >= 0 : false;
      }
    });
  }());

  return function middleware( req , res , next ){
    Q.fcall(function(){
      if (req.method != 'GET') {
        return Q.reject();
      }
    })
    .then(function(){
      var fpath;
      return res.data || Q.fcall(function(){
        fpath = resolvePath( $preprocessor.root , url.parse( req.url ).pathname.substr( 1 ));
      })
      .then(function getStats(){
        return Q.promise(function( resolve , reject ){
          fs.stat( fpath , function( err , stats ){
            return err ? reject( err ) : resolve( stats );
          });
        })
        .then(function( stats ){
          if (stats.isDirectory()) {
            fpath = path.join( fpath , $preprocessor.index );
            return getStats();
          }
          return stats;
        });
      })
      .then(function( stats ){
        if (stats.isFile() && $preprocessor._accepts( fpath )) {
          return Q.promise(function( resolve , reject ){
            fs.readFile( fpath , 'utf-8' , function( err , content ){
              return err ? reject( err ) : resolve( content );
            });
          });
        }
        return Q.reject();
      });
    })
    .then(function( content ){
      return Q.promise(function( resolve ){
        var processed = $preprocessor.engine( content , resolve );
        if (typeof processed == 'string') {
          resolve( processed );
        }
      });
    })
    .then(function( content ){
      // content = $preprocessor.engine( content );
      if ($preprocessor.chain) {
        res.data = content;
        next();
      }
      else {
        delete res.data;
        res.end( content );
      }
    })
    .fail( next );
  };
};
