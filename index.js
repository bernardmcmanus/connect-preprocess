module.exports = function( options ){
  'use strict';

  var Q = require( 'q' );
  var url = require( 'url' );
  var mime = require( 'mime' );
  var fs = require( 'fs-extra' );
  var _ = require( 'lodash' );
  var resolvePath = require( 'resolve-path' );

  var $preprocessor = (function(){
    var defaults = {
      root: process.cwd(),
      index: 'index.html',
      accept: [ 'html' , 'css' , 'js' ],
      engine: function( string ) { return string }
    };
    return _.extend( defaults , options , {
      _accepts: function( fpath ){
        var match = fpath.match( /\.(\w+)$/ );
        return match ? $preprocessor.accept.indexOf( match[1] ) >= 0 : false;
      }
    });
  }());

  return function middleware( req , res , next ){
    var pathname = url.parse( req.url ).pathname;
    var fpath = resolvePath( $preprocessor.root , pathname.substr( 1 ));
    Q.fcall(function(){
      if (req.method != 'GET') {
        return Q.reject();
      }
    })
    .then(function(){
      return Q.fcall(function getStats(){
        return Q.promise(function( resolve , reject ){
          fs.stat( fpath , function( err , stats ){
            return err ? reject() : resolve( stats );
          });
        })
        .then(function( stats ){
          if (stats.isDirectory() && $preprocessor.index) {
            fpath = resolvePath( fpath , $preprocessor.index );
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
      var $req = _.extend(Object.create( req ), {
        root: fpath.substr( 0 , fpath.indexOf( pathname )),
        pathname: fpath.substr(fpath.indexOf( pathname )),
        mime: mime.lookup( fpath )
      });
      return Q.resolve().then(function(){
        return $preprocessor.engine( content , $req );
      })
      .then(function( processed ){
        res.setHeader( 'Content-Type' , $req.mime );
        res.setHeader( 'Content-Length' , Buffer.byteLength( processed ));
        return processed;
      });
    })
    .then(function( content ){
      res.end( content );
    })
    .fail( next );
  };
};
