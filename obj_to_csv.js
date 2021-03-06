// Core modules
var fs = require('fs')
var p = require('path')

// Node modules
var async = require('async')
var sqwk = require('sqwk')

// App modules
var config = require('./config')
var util = require('./lib/util')
var title = require('./lib/title')
var list_obj = require('./lib/list')
var read_obj = require('./lib/read')
var process_obj = require('./lib/process')

// Global vars
var time = util.machine_date(new Date())

// @todo Can the number of nested async be reduced?
async.waterfall([
	function(callback) {
		
		title(function(err, messages) {
			sqwk.send(messages)
		})

		if(config.write) {
			// Create a directory for the output
			try {
				fs.mkdirSync(p.join(config.export_directory, time))
			} catch(err) {
				callback(err)
			}
		}

		list_obj(config.source_directory, function(err, objects) {
			if(err) callback(err)
			callback(null, objects)
		})
	
	},
	function(objects, callback) {

		async.each(objects, function(object) {
			
			if(config.log) sqwk.send([['Processing object', object]])
			
			var coords = []
			
			// For every frame read the coordinate data from the .obj file
			async.eachSeries(config.track_frames, function(frame, callback2) {
				// @todo Reduce callback hell, use async waterfall
				// 	coords.push(process_obj(		read_obj(object, config.track_frames[i])			 ).join())
				async.waterfall([

					function(callback3) {
						read_obj(object, frame, function(err, lines) {
							if(err) callback(err)
							callback3(null, lines)
						})
					},

					function(lines, callback3) {
						process_obj(lines, function(err, mid_array) {
							// @todo Reduce this mess...
							callback3(null, mid_array.join())
						})
					},

					function(coord_string, callback3){  

						coords.push(coord_string)

						callback3(null, 'complete');
					}

					], function(err, result) {
						if(err) callback(err)
						callback2(null)
					}

				) // async

			}, function(err) {
				// Place each frame on a new line
				coords = coords.join("\n")
				sqwk.send([['Object ' + config.track_mode + ' coords'], coords])

				var path = p.join(config.export_directory, time, object) + '.csv'

				if(config.write) {
					fs.writeFile(path, coords, function(err) {
						if(err) throw err
						if(config.log) sqwk.send([['Data written to', path]])
					})
				}
				else {
					if(config.log) sqwk.send([['Writing disabled', path]])
				}
			}) // async.eachSeries(frames)

		}, function(err) {

			callback(null, coords)

		}) // async.each(objects)
	}], function(err, coords) {
		if(err) {
			if(err.code === 'ENOENT') {
				sqwk.error(['No such file or directory', err.path], true)
			}
			else {
				throw err
			}
		}
	}
)