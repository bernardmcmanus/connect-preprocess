module.exports = (function(){
  'use strict';

  var url = require( 'url' );
  var path = require( 'path' );
  var fs = require( 'fs-extra' );
  var extend = require( 'extend' );
  var resolvePath = require( 'resolve-path' );
  var Promise = require( 'bluebird' );
  
  // configure bluebird
  // Promise.config({ cancellation: true });

  function Preprocessor( options ){
    var $preprocessor = (function(){
      var defaults = {
        _isChained: false,
        root: process.cwd(),
        index: 'index.html',
        accept: [ 'html' , 'css' , 'js' ],
        engine: function( string ){ return string }
      };
      return extend( defaults , options , {
        _index: 0,
        _chained: [],
        _accepts: function( fpath ){
          var match = fpath.match( /\.(\w+)$/ );
          return match ? $preprocessor.accept.indexOf( match[1] ) >= 0 : false;
        }
      });
    }());

    function middleware( req , res , next ){
      $preprocessor._index = 0;
      return Promise.resolve().then(function(){
        if (req.method != 'GET') {
          return Promise.reject();
        }
      })
      .then(function(){
        var fpath;
        return res.data || Promise.resolve().then(function(){
          fpath = resolvePath( $preprocessor.root , url.parse( req.url ).pathname.substr( 1 ));
        })
        .then(function getStats(){
          return new Promise(function( resolve , reject ){
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
            return new Promise(function( resolve , reject ){
              fs.readFile( fpath , 'utf-8' , function( err , content ){
                return err ? reject( err ) : resolve( content );
              });
            });
          }
          return Promise.reject();
        });
      })
      .then(function( content ){
        var processed = $preprocessor.engine( content );
        if (Buffer.isBuffer( processed )) {
          processed = processed.toString();
        }
        return processed;
      })
      .then(function( content ){
        res.data = content;
      })
      .catch(function( err ){
        return err ? Promise.reject( err ) : null;
      })
      .then(function(){
        return $preprocessor._isChained ? null : middleware.next( req , res , next );
      })
      .catch( next );
    }

    middleware.and = function( options ){
      options._isChained = true;
      var chained = Preprocessor( options );
      $preprocessor._chained.push( chained );
      return middleware;
    };

    middleware.next = function( req , res , next ){
      if ($preprocessor._index < $preprocessor._chained.length) {
        return $preprocessor._chained[$preprocessor._index]( req , res , next ).then(function(){
          $preprocessor._index++;
          return middleware.next( req , res , next );
        });
      }
      else if (res.data) {
        res.end( res.data );
      }
      else if (!res.headersSent) {
        next();
      }
    };

    return middleware;
  }

  return Preprocessor;
}());
