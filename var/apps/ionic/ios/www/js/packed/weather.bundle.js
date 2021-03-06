/*global
 App, angular, moment, BASE_PATH, BASE_URL
 */

angular.module("starter").controller("WeatherController", function(Modal, $scope, $stateParams, $window, Country,
                                                                   LinkService, Weather) {

    angular.extend($scope, {
        is_loading              : true,
        value_id                : $stateParams.value_id,
        error                   : false,
        woeid                   : null,
        show_weather_details    : null,
        show_change_location    : null,
        new_location            : {},
        card_design             : false
    });

    Weather.setValueId($stateParams.value_id);

    $scope.loadContent = function() {

        $scope.is_loading = true;

        /** Seriously ? one call for this :'( */
        Country.findAll()
            .then(function(data) {
                $scope.country_list = data;
            });

        /** This one too hop hop hop embed ! */
        Weather.find()
            .then(function(data) {
                $scope.page_title           = data.page_title;
                $scope.unit                 = data.collection.unit;
                $scope.icon_url             = data.icon_url;
                $scope.icon_error_url       = BASE_URL + "/template/block/colorize/color/" + $window.colors.list_item.color.replace("#","") + "/path/" + btoa($scope.icon_url + "weather_3200.png");
                $scope.icon_wind            = BASE_URL + "/template/block/colorize/color/" + $window.colors.list_item.color.replace("#","") + "/path/" + btoa($scope.icon_url + "wind.png");
                $scope.icon_atmosphere      = BASE_URL + "/template/block/colorize/color/" + $window.colors.list_item.color.replace("#","") + "/path/" + btoa($scope.icon_url + "atmosphere.png");
                $scope.icon_astronomy       = BASE_URL + "/template/block/colorize/color/" + $window.colors.list_item.color.replace("#","") + "/path/" + btoa($scope.icon_url + "astronomy.png");

                if(data.collection.woeid) {
                    $scope.woeid = data.collection.woeid;
                    $scope.getWeather();
                }

                $scope.is_loading = false;

            });
    };

    $scope.getWeather = function() {
        Weather.getWeather($scope.woeid, $scope.unit)
            .then(function(data) {

                $scope.weather = data.query.results.channel;
                $scope.weather_date = moment(data.query.created).calendar();
                $scope.current_icon_url = BASE_URL+"/template/block/colorize/color/" + $window.colors.list_item.color.replace("#","") + "/path/" + btoa($scope.icon_url + "weather_" + $scope.weather.item.condition.code + ".png");
                $scope.forecast_1_icon_url = BASE_URL+"/template/block/colorize/color/" + $window.colors.list_item.color.replace("#","") + "/path/" + btoa($scope.icon_url + "weather_" + $scope.weather.item.forecast[1].code + ".png");
                $scope.forecast_2_icon_url = BASE_URL+"/template/block/colorize/color/" + $window.colors.list_item.color.replace("#","") + "/path/" + btoa($scope.icon_url + "weather_" + $scope.weather.item.forecast[2].code + ".png");
                $scope.forecast_3_icon_url = BASE_URL+"/template/block/colorize/color/" + $window.colors.list_item.color.replace("#","") + "/path/" + btoa($scope.icon_url + "weather_" + $scope.weather.item.forecast[3].code + ".png");
                $scope.forecast_4_icon_url = BASE_URL+"/template/block/colorize/color/" + $window.colors.list_item.color.replace("#","") + "/path/" + btoa($scope.icon_url + "weather_" + $scope.weather.item.forecast[4].code + ".png");
                $scope.is_loading = false;
            }, function(message) {
                $scope.error = true;
                $scope.error_message = message;
                $scope.is_loading = false;
            });
    };

    /** Wheather details ok */
    $scope.openDetails = function() {

        Modal
            .fromTemplateUrl("weather-details.html", {
                scope: $scope
            }).then(function(modal) {
                $scope.details_modal = modal;
                $scope.details_modal.show();
            });
    };

    $scope.closeDetails = function() {
        $scope.details_modal.remove();
    };

    $scope.openChangeLocationForm = function() {
        Modal
            .fromTemplateUrl("weather-change-location-form.html", {
                scope: $scope
            }).then(function(modal) {
                $scope.location_form_modal = modal;
                $scope.location_form_modal.show();
            });
    };

    $scope.closeChangeLocationForm = function() {
        $scope.location_form_modal.remove();
    };

    $scope.changeLocation = function() {

        $scope.is_loading = true;

        if($scope.new_location.country && !$scope.new_location.use_user_location) {
            var param = "";
            if($scope.new_location.city) {
                param = $scope.new_location.city + "," + $scope.new_location.country;
            } else {
                param = $scope.new_location.country;
            }

            Weather.getWoeid(param)
                .then(function(data) {
                    var woeid = null;
                    if(data["query"]["count"]> 0) {
                        if(data["query"]["results"]["place"].length > 1) {
                            woeid = data["query"]["results"]["place"][0]["woeid"];
                        } else {
                            woeid = data["query"]["results"]["place"]["woeid"];
                        }
                    }

                    if(woeid) {
                        $scope.woeid = woeid;
                        $scope.getWeather();
                    } else {
                        $scope.error = true;
                        $scope.error_message = "Unable to get woeid.";
                    }
                });
        } else {
            $scope.woeid = null;
            $scope.getWeather();
        }

        $scope.closeChangeLocationForm();

    };

    $scope.openYahooWebsite = function() {
        LinkService.openLink("https://www.yahoo.com/?ilc=401");
    };

    $scope.loadContent();

});;/*global
 App, device, angular, btoa
 */

/**
 * Weather
 *
 * @author Xtraball SAS
 */
angular.module("starter").factory("Weather", function($q, $pwaRequest, $cordovaGeolocation, GoogleMaps) {

    var factory = {
        value_id        : null,
        extendedOptions : {}
    };

    /**
     *
     * @param value_id
     */
    factory.setValueId = function(value_id) {
        factory.value_id = value_id;
    };

    /**
     *
     * @param options
     */
    factory.setExtendedOptions = function(options) {
        factory.extendedOptions = options;
    };

    factory.find = function() {

        if(!this.value_id) {
            return $pwaRequest.reject("[Factory::Weather.find] missing value_id");
        }

        var payload = $pwaRequest.getPayloadForValueId(factory.value_id);
        if(payload !== false) {

            return $pwaRequest.resolve(payload);

        } else {

            /** Otherwise fallback on PWA */
            return $pwaRequest.get("weather/mobile_view/find", angular.extend({
                urlParams: {
                    value_id: this.value_id
                }
            }, factory.extendedOptions));

        }


    };

    factory.getWeather = function(woeid, unit) {
        var deferred = $q.defer();

        if(woeid) {
            factory.getWeatherFromWoeid(woeid, unit).then(function(data) {
                if(!data.query.results.channel.astronomy) {
                    deferred.reject("Unable to get weather for this location.");
                } else {
                    deferred.resolve(data);
                }
            }, function() {
                deferred.reject("Unable to get weather.");
            });
        } else {

            /***
             * @todo use location service
             */
            $cordovaGeolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }).then(function(position) {

                GoogleMaps.reverseGeocode(position.coords).then(function(data) {
                    var postal_code = null;
                    var country = null;

                    if(data[0]["address_components"][6]) {
                        if(data[0]["address_components"][6]["types"][0] == "postal_code") {
                            postal_code = data[0]["address_components"][6]["long_name"];
                        }
                    }

                    if(data[0]["address_components"][5]) {
                        country = data[0]["address_components"][5]["short_name"];
                    }

                    if(country) {
                        var param = "";
                        if(postal_code) {
                            param = postal_code + "," + country;
                        } else {
                            param = country;
                        }

                        factory.getWoeid(param)
                            .then(function(data) {

                            var woeid = null;
                            if(data["query"]["count"]> 0) {
                                if(data["query"]["results"]["place"].length > 1) {
                                    woeid = data["query"]["results"]["place"][0]["woeid"];
                                } else {
                                    woeid = data["query"]["results"]["place"]["woeid"];
                                }
                            }

                            if(woeid) {
                                factory.getWeatherFromWoeid(woeid, unit).then(function(data) {

                                    if(!data.query.results.channel.astronomy) {
                                        deferred.reject("Unable to get weather for this location.");
                                    } else {
                                        deferred.resolve(data);
                                    }
                                }, function() {
                                    deferred.reject("Unable to get weather.");
                                });
                            } else {
                                deferred.reject("Unable to get your woeid.");
                            }
                        }, function() {
                            deferred.reject("Unable to get your woeid.");
                        });

                    } else {
                        deferred.reject();
                    }
                }, function(message) {
                    deferred.reject(message);
                });

            }, function (err) {
                deferred.reject(err);
            });

        }

        return deferred.promise;
    };

    factory.getWoeid = function(param) {

        var yql = encodeURI("select woeid from geo.places where text='" + param + "'");

        return $pwaRequest.post("/weather/mobile_view/proxy", {
            data: {
                request: btoa("https://query.yahooapis.com/v1/public/yql?q=" + yql + "&format=json")
            },
            cache: false
        });
    };

    factory.getWeatherFromWoeid = function(woeid, unit) {

        var yql = encodeURI("select * from weather.forecast where woeid='" + woeid + "' and u='" + unit + "'");

        return $pwaRequest.post("/weather/mobile_view/proxy", {
            data: {
                request: btoa("https://query.yahooapis.com/v1/public/yql?q=" + yql + "&format=json&lang=fr-FR")
            },
            cache: false
        });
    };

    return factory;
});
