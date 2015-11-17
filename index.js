module.exports = (function(){
  'use strict';

  var url = require( 'url' );
  var path = require( 'path' );
  var mime = require( 'mime' );
  var fs = require( 'fs-extra' );
  var extend = require( 'extend' );
  var resolvePath = require( 'resolve-path' );
  var Promise = require( 'bluebird' );

  function Preprocessor( options ){
    options = extend({
      // _isChained: false,
      root: process.cwd(),
      index: 'index.html',
      accept: [ 'html' , 'css' , 'js' ],
      engine: function( string ){ return string }
    }, options );

    extend( $preprocessor , options , {
      // _index: 0,
      _index: {},
      _chained: [],
      _accepts: function( fpath ){
        var match = fpath.match( /\.(\w+)$/ );
        return match ? $preprocessor.accept.indexOf( match[1] ) >= 0 : false;
      },
      and: function( $options ){
        var chained = Preprocessor(extend({ root: options.root }, $options ));
        chained.next = function(){
          return $preprocessor.next.apply( null , arguments );
        };
        $preprocessor._chained.push( chained );
        return $preprocessor;
      },
      next: function( req , res , next ){
        if ($preprocessor._index[req.url] < $preprocessor._chained.length) {
          $preprocessor._index[req.url]++;
          return $preprocessor._chained[$preprocessor._index[req.url]-1]( req , res , next ).then(function(){
            return $preprocessor.next( req , res , next );
          });
        }
        else if (!res.headersSent) {
          if (res.data) {
            // console.log('end');
            res.setHeader( 'Content-Type' , mime.lookup( req.fpath ));
            res.end( res.data );
          }
          else {
            next();
          }
        }
      }
    });

    function $preprocessor( req , res , next ){
      $preprocessor._index[req.url] = 0;
      return Promise.resolve().then(function(){
        if (req.method != 'GET') {
          return Promise.reject();
        }
      })
      .then(function(){
        return Promise.resolve().then(function(){
          return req.fpath || resolvePath( $preprocessor.root , url.parse( req.url ).pathname.substr( 1 ));
        })
        .then(function getStats( fpath ){
          return new Promise(function( resolve , reject ){
            return req.stats ? resolve( req.stats ) : fs.stat( fpath , function( err , stats ){
              return err ? reject( err ) : resolve( stats );
            });
          })
          .then(function( stats ){
            if (stats.isDirectory()) {
              fpath = path.join( fpath , $preprocessor.index );
              return getStats( fpath );
            }
            return [ fpath , stats ];
          });
        });
      })
      .spread(function( fpath , stats ){
        req.fpath = fpath;
        req.stats = stats;
        if (stats.isFile() && $preprocessor._accepts( fpath )) {
          // console.log('accept %s',fpath,$preprocessor.accept);
          return res.data || new Promise(function( resolve , reject ){
            fs.readFile( fpath , 'utf-8' , function( err , content ){
              return err ? reject( err ) : resolve( content );
            });
          });
        }
        return Promise.reject();
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
        return /*$preprocessor._isChained ? null : */$preprocessor.next( req , res , next );
      })
      .catch( next );
    }

    return $preprocessor;
  }

  return Preprocessor;
}());
