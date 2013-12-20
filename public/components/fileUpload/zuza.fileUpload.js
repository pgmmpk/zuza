// adapted from: http://jsfiddle.net/danielzen/utp7j/

(function(angular, $) {
	'use strict';

	var module = angular.module('zuza.fileUpload', ['ngRoute', 'zuza.utils']);

	/**
	 * Specifies default values for zuzaFileInput directive.
	 */
	module.constant('zuzaFileInputConfig', {
		multiple: true,
		accept: "*/*"
	});

	/**
	 * @ngdoc directive
	 * @name zuza.fileUpload.directive:zuzaFileInput
	 * @description
	 *
	 * Replaces ugly default browser <input type="file"> button with stylable and
	 * Angular-friendly one.
	 *
	 * @param {model} files		 - list of files to upload (name of parent scope model)
	 * @param {expression} onChange - handler that is triggered when files are updated
	 * @param {string} accept	   - accept string, see docs for HTML file input element. Default is '* /*'.
	 * @param {boolean} multiple	- if true allows multiple files to be selected. Default is true.
	 *
	 * @example
	 *
	 * <button class='btn' zuza-file-input multiple accept='text/plain,image/*'
	 *						  files='files' onChane='handleChange()'>Browse</button>
	 *
	 */
	module.directive('zuzaFileInput', ['zuzaFileInputConfig', function(zuzaFileInputConfig) {
		return {
			restrict: 'A', // attr only
			scope: {
				files   : '=',
				onChange: '&'
			},
			link: function(scope, elm, attrs) {
				//console.log('linkning zuza-file-input');

				if (!scope.files) {
					throw new Error('files attribute must be defined');
				}

				var fileInput = $('<input type="file" style="visibility:hidden">');
				fileInput.attr({
					multiple: attrs.multiple || zuzaFileInputConfig.multiple,
					accept: attrs.accept || zuzaFileInputConfig.accept
				});

				elm.after(fileInput);

				fileInput.on('change', function() {
					scope.$apply(function() {
						//console.log('files changed!', fileInput[0].files);
						scope.files.length = 0;
						angular.forEach(fileInput[0].files, function(f) {
							scope.files.push(f);
						});
						//console.log('FILES:', scope.files);
						scope.onChange({files: scope.files});
					});
				});

				elm.on('click', function() {
					fileInput.click();
				});
			}

		};
	}]);

	/**
	 * Service that uploads list of files to the server.
	 */
	module.service('zuzaFileUploadService', ['$q', 'Auth', function($q, Auth) {

		return {

			/**
			 * Uploads list of files to the specified address.
			 *
			 * @param {list} files - list of files to upload.
			 * @param {string} postUrl - URL to post files to.
			 * @returns {promise} promise. Success is resolved to raw XMLHttpRequest event (can be used to
			 *		  get server response text). Failure is resolved to a string. Progress notifications are
			 *		  communicated in two ways: as progress parameter to the promise.notify() that represents
			 *		  the overall progress number (0-100). Besides this every element of files array gets
			 *		  progress member that is computed from overall progress. If file length can not be
			 *		  computed, all progress values are set to -1.
			 */
			upload: function(files, postUrl, postParameters) {
				var deferred = $q.defer();

				if (files.length === 0) {
					deferred.reject('no files');
					return deferred.promise;
				}

				function uploadComplete(evt) {
					if (evt.target.status !== 200) {
						console.log(evt.target.status, evt.target);
						deferred.reject(evt.target.statusText);
					} else {
						deferred.resolve(evt);
					}
				}

				function uploadProgress(evt) {
					if (evt.lengthComputable) {

						var progress = Math.round(evt.loaded * 100 / evt.total);
						var loaded = evt.loaded;
						angular.forEach(files, function(f) {
							if (loaded >= f.size) {
								f.progress = 100;
								loaded -= f.size;
							} else {
								f.progress = 100 * loaded / f.size;
								loaded = 0;
							}
						});
						deferred.notify(progress);
					} else {
						angular.forEach(files, function(f) {
							f.progress = -1;
						});
						deferred.notify(-1);
					}
				}

				var fd = new FormData();
				angular.forEach(files, function(f) {
					fd.append("uploadedFile", f);
					f.progress = 0;
				});
				if (postParameters) {
					for (var key in postParameters) {
						fd.append(key, '' + postParameters[key]);
					}
				}
				var xhr = new XMLHttpRequest();
				xhr.upload.addEventListener("progress", uploadProgress, false);
				xhr.addEventListener("load", uploadComplete, false);
				xhr.addEventListener("error", function() {deferred.reject('failed');}, false);
				xhr.addEventListener("abort", function() {deferred.reject('aborted');}, false);
				xhr.open("POST", postUrl);
				
				var user = Auth.getUser();
				if (user && user.token) {
					xhr.setRequestHeader('Authorization', 'Zuza ' + user.token);
				}
				xhr.send(fd);

				return deferred.promise;
			}
		};
	}]);

	module.controller('ZuzaFileUploadCtrl', ['$scope', 'zuzaFileUploadService',
															function($scope, zuzaFileUploadService) {
		//console.log($scope);

		$scope.files = [];
		$scope.uploadInProgress = false;
		$scope.progress = 0;
		$scope.error = '';

		$scope.onChange = function() {
			angular.forEach($scope.files, function(f) {
				f.progress = 0;
			});
		};

		$scope.clearFiles = function() {
			$scope.files.length = 0;
		};

		$scope.uploadFiles = function() {
			//console.log('uploading', $scope.files);
			if ($scope.files.length === 0) {
				return;
			}

			$scope.uploadInProgress = true;
			$scope.error = '';

			var extraParams = {};
			if ($scope.api && $scope.api.extraPostParams) {
				extraParams = $scope.api.extraPostParams();
			}

			// console.log('EXTRA:', extraParams);

			zuzaFileUploadService.upload($scope.files, $scope.postUrl, extraParams).then(function(evt) {
				$scope.uploadInProgress = false;
				$scope.progress = 100;
				if ($scope.onFinished) {
					$scope.onFinished({response: evt.target});
				}
			}, function(reason) {
				$scope.error = 'Error: ' + reason;
				$scope.uploadInProgress = false;
				if ($scope.onFailed) {
					$scope.onFailed({reason: reason});
				}
			}, function(progress) {
				$scope.progress = progress;
			});
		};

		if ($scope.api) {
			$scope.api.clearFiles = $scope.clearFiles;
			$scope.api.uploadFiles = $scope.uploadFiles;
		}
	}]);

	/**
	 * Specifies default values for zuzaFileUpload directive.
	 */
	module.constant('zuzaFileUploadConfig', {
		postUrl: '/fileupload',

		textHeader: 'Files to be uploaded',
		textBrowse: 'Browse',
		textUpload: 'Upload All',
		textClear : 'Clear All',
		textWait  : 'Please wait, uploading...'
	});

	/**
	 * @ngdoc directive
	 * @name zuza.fileUpload.directive:zuzaFileUpload
	 * @param postUrl    - URL to post files to. Can be specified as attr or globally via zuzaFileUploadConfig.
	 * @param textBrowse - text of "Browse" button. Can be specified as attr or globally via zuzaFileUploadConfig.
	 * @param textUpload - text of "Upload All" button. Can be specified as attr or globally via zuzaFileUploadConfig.
	 * @param textClear  - text of "Clear All" button. Can be specified as attr or globally via zuzaFileUploadConfig.
	 * @param textWait   - text of "Please wait, uploading..." paragraph. Can be specified as attr or globally via
	 *					      zuzaFileUploadConfig.
	 *
	 * @example
	 *
	 *	  <zuza-file-upload post-url='/fileupload' text-browse='Select File(s)' />
	 *
	 */
	module.directive('zuzaFileUpload', ['zuzaFileUploadConfig', function(zuzaFileUploadConfig) {
		return {
			restrict: 'E', // element only
			controller: 'ZuzaFileUploadCtrl',
			replace: true,
			scope: {
				postUrl: '=',
				api: '=',
				onFinished: '&',
				onFailed: '&'
			},
			transclude: true,
			template: '<div>' +
						'<button zuza-file-input files="files" ng-hide="files.length" on-change="onChange(files)" class="btn btn-default">' +
							'{{textBrowse}}' +
						'</button>' +
						'<div ng-show="files.length">' +
							'<h3 class="text-center">{{textHeader}}</h3>' +
							'<table class="table">' +
								'<tr ng-repeat="f in files">' +
									'<td>{{f.name}}</td>' +
									'<td>{{f.size | zuzaBytes}}</td>' +
									'<td>' +
										'<div class="zuza-progress-bar">' +
											'<div ng-style="{width: f.progress + \'%\'}" class="zuza-uploaded"></div>' +
										'</div>' +
									'</td>' +
								'</tr>' +
							'</table>' +
						'<div class="zuza-progress-bar">' +
							'<div ng-style="{width: progress + \'%\'}" class="zuza-uploaded"></div>' +
						'</div>' +
						'<div ng-transclude></div>' +
						'<button ng-click="uploadFiles()" ng-disabled="uploadInProgress" class="btn btn-default">{{textUpload}}</button>' +
						'<button ng-click="clearFiles()" ng-disabled="uploadInProgress" class="btn btn-default">{{textClear}}</button>' +
						'<p ng-show="uploadInProgress" class="wait">{{textWait}}</p>' +
						'<p ng-show="error" class="error">{{error}}</p>' +
					'</div>',
			link: function(scope, elm, attrs) {
				['textHeader', 'textBrowse', 'textUpload', 'textClear', 'textWait'].forEach(function(key) {
					scope[key] = attrs[key] || zuzaFileUploadConfig[key];
				});
			}
		};
	}]);

})(angular, jQuery);
