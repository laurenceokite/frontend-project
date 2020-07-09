// Simple obfuscation to prevent scraping - key is scrambled here and then reassembled in code.
const bingFragments = [ "Anhz", "u3sc", "lddW", "XySE", "_-mD", "47H8", "2t3i", "GAHV", "uUrv", "6zb1", "QY5f", "_m2a", "Y-df", "-5A2", "lzMb", "8FyP" ];
const zipFragments = [ "5fMZ", "uis6", "biA4", "ZNwR", "9h1q", "ZKEC", "nEdI", "Up8D", "Eaiq", "OyJG", "UPNU", "r7eG", "ri8E", "MCxz", "EloA", "75Qa" ];

const stateLookup = { AL: "Alabama", AK: "Alaska", AS: "American Samoa", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", GU: "Guam", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", MP: "North Mariana Is", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", VI: "Virgin Islands", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"};

const breweryColorDefault = "#208020";
const breweryColorFavorite = "#4080ff";
const breweryColorVisited = "#206020";

var breweryList = $("#breweryList");

var map // Microsoft map object.
var breweryData = [];

// Handler for the Search button
var searchCityState = function(event) {
	event.preventDefault();
	var cityName = $("#byCity").val();
	var stateName = $("#byState").val();

	var fetchUrl = "https://api.openbrewerydb.org/breweries?";

	if (cityName) {
		fetchUrl += "by_city=" + cityName.toLowerCase() + "&";
	}

	if ((stateName) && (stateName != "State")) {
		fetchUrl += "by_state=" + stateName.toLowerCase() + "&";
	} else if (!cityName) {
		// TODO - Display error message! (no city or state entered)
		return;
	}

	// TODO - Add filters if needed - probably put this in its own function so radius search can use it too.

	fetch(fetchUrl + "per_page=50").then(function (response) {
		breweryList.text(""); // Clear previous results.

		if (response.ok) {
			// TODO - How to deal with paginated results?  I'd like to combine them into a single large list.
			response.json().then(processBreweryData);
		}
		else {
			breweryData = []; // Clear old data.
			// TODO - Display an error message!
			console.log("ERROR ACCESSING BREWERY API!")
		}		
	})
}

// Displays returned brewery data to the screen.
var processBreweryData = function(data) {
	breweryData = data;

	breweryData.sort(function(a, b) {
		return a.name.localeCompare(b.name);
	});

	for (var i = 0; i < breweryData.length; i++) {
		if ((breweryData[i].street) && (breweryData[i].brewery_type != "planning")) {
			breweryList.append(
				"<li class='list-group-item flex-container align-justify align-middle'>" +
					"<div>" +
					"<strong>" + breweryData[i].name + "</strong>" +
					"<p class='subheader'>" + breweryData[i].street + ", " + breweryData[i].city + "</p>" +
					"</div>" +
					"<div class='flex-container'>" +
					"<div class='checkbox'>" +
						"<input id='favorite' class='checkbox-element' type='checkbox'  name='favorite' value='favorited'>" + // TODO - Set value! -done
						"<i class='foundicon-heart'></i>" +
					"</div>" +
					"<div class='checkbox'>" +
						"<input id='check' class='checkbox-element' type='checkbox' name='visited' value='visited'>" + // TODO - Set value! -done
						"<i class='foundicon-checkmark'></i>" +
					"</div>" +
					"</div>" +
				"</li>"
			);

			// If we don't have location info, get it from Bing!
			if ((!breweryData[i].latitude) || (!breweryData[i].longitude)) {
				getLatitudeLongitude(i, true);
			}
		} else {
			breweryData.splice(i, 1);
			i--; // There is now a new item at our current position, pull the list counter back by one so it gets processed.
		}
	}

	refreshMap();
}

// Helper function - Retrieve missing lat/lon for brewery at the given index in our data.
var getLatitudeLongitude = function(idx, updateMapBounds=false) {
	var buildKey = "";

	for (var i = 0; i < bingFragments.length; i++) {
		buildKey += bingFragments[(13 * i) % bingFragments.length];
	}

	fetch(
		"http://dev.virtualearth.net/REST/v1/Locations/US/" + breweryData[idx].state.trim() + "/" + breweryData[idx].postal_code.trim() + "/" + breweryData[idx].city.trim() + "/" + breweryData[idx].street.trim() + "?key=" + buildKey
	).then(function (response) {
		if (response.ok) {
			response.json().then(function (tmpData) {
				if (tmpData.resourceSets[0].resources[0].point.coordinates) {
					breweryData[idx].latitude = tmpData.resourceSets[0].resources[0].point.coordinates[0];
					breweryData[idx].longitude = tmpData.resourceSets[0].resources[0].point.coordinates[1];
				}

				createMapPin(idx);

				if (updateMapBounds) {
					calculateMapBounds();
				}
			});
		}
	})
}

// Resets the map widget.
var refreshMap = function() {
	if (!breweryList.children().length) {
		// TODO - Hide output div!  Just adding Foundation's hide class here breaks layout???
		//$("#output").addClass("hide");
		return;
	}

	var pin;

	// If we already have a map, clear all markers.  Otherwise, make the map.
	if (map) {
		map.entities.clear();
	}
	else {
		map = new Microsoft.Maps.Map("#mapDisplay");
	}

	// TODO - Unhide output div!
	//$("#output").removeClass("hide");

	for (var i = 0; i < breweryData.length; i++) {
		if ((breweryData[i].latitude) && (breweryData[i].longitude)) {
			createMapPin(i);
		}
	}

	calculateMapBounds();
}

// Change the viewing area for the map.
// Called when pins are added, but also as getLatitudeLongitude calls come in.
var calculateMapBounds = function() {
	var locs = [];

	for (var i = 0; i < breweryData.length; i++) {
		if (breweryData[i].pin) {
			locs.push(breweryData[i].pin.getLocation());
		}
	}

	map.setView({ bounds: Microsoft.Maps.LocationRect.fromLocations(locs), padding: 80 });
}

// Creates a map pin for the brewery at the specified index.
// This is in its own function because it can be used by getLatitudeLongitude or refreshMap.
var createMapPin = function(idx) {
	if (!breweryData[idx].pin) {
		//Create custom Pushpin
		var loc = new Microsoft.Maps.Location(breweryData[idx].latitude, breweryData[idx].longitude);
		pin = new Microsoft.Maps.Pushpin(loc, {
			title: breweryData[idx].name,
			color: breweryColorDefault, // TODO - Pick color based on favorite/visited status!
			text: (idx + 1).toString()
		});

		breweryData[idx].pin = pin; // Save our pin so we can manipulate it later.

		//Add the pushpin to the map
		map.entities.push(pin);
	}
}

var setBreweryFavorite = function(idx, favorite) {
	// TODO - localStorage manipulation!
	if (favorite) {
		breweryData[idx].pin.setOptions({color: breweryColorFavorite});
	} else {
		// TODO - Check visited status and set accordingly!
		breweryData[idx].pin.setOptions({color: breweryColorDefault});
	}
}

var setBreweryVisited = function(idx, visited) {
	// TODO - localStorage manipulation!
	// TODO - Once we can check if a brewery is favorited, we shoult let the favorite color overrule, and return out of here.
	if (visited) {
		breweryData[idx].pin.setOptions({color: breweryColorVisited});
	} else {
		breweryData[idx].pin.setOptions({color: breweryColorDefault});
	}
}

// Assembles our Bing key and adds the necessary JS reference.
var initialize = function() {
	var buildKey = "";

	for (var i = 0; i < bingFragments.length; i++) {
		buildKey += bingFragments[(13 * i) % bingFragments.length];
	}

	var scriptEl = document.createElement("script");
	scriptEl.setAttribute("type", "text/javascript");
	scriptEl.setAttribute("src", "http://www.bing.com/api/maps/mapcontrol?callback=refreshMap&key=" + buildKey);
	scriptEl.setAttribute("async", "");
	scriptEl.setAttribute("defer", "");
	document.head.appendChild(scriptEl);

	if (navigator.geolocation)
	{
		navigator.geolocation.getCurrentPosition((position) => 
		{
			fetch(
				"http://dev.virtualearth.net/REST/v1/Locations/" + position.coords.latitude + "," + position.coords.longitude + "?key=" + buildKey
			).then(function (response) {
				if (response.ok) {
					response.json().then(function (data) {
						// Weirdly, the city doesn't get its own field in the response, so we'll extract it from the full address.
						// Formatted address looks like: "123 Easy St, Anytown, WI 54799"
						var addressParts = data.resourceSets[0].resources[0].address.formattedAddress.split(",");

						$("#byCity").val(addressParts[1].trim());
						$("#distanceZip").val(data.resourceSets[0].resources[0].address.postalCode);

						if (data.resourceSets[0].resources[0].address.adminDistrict in stateLookup) {
							$("#byState").val(stateLookup[data.resourceSets[0].resources[0].address.adminDistrict]);
						}
					});
				}
			});
		});
	}
}

initialize();
$(document).foundation();

$("#searchCityState").on("click", searchCityState);