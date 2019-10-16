//create map
function createMap(){
    var map = L.map('map', {
        center: [47, -95],
        zoom: 3
    });

    //add tile layer
    var osmBase = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        minZoom: 1,
        maxZoom: 16
    }).addTo(map);
    
    var tonerBase = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-background/{z}/{x}/{y}.png', {
        attribution:
            'Map tiles by <a href="http://stamen.com">Stamen Design<\/a>, ' +
            '<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0<\/a> &mdash; ' +
            'Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        minZoom: 1,
        maxZoom: 16
    }).addTo(map);
    
    L.control.sideBySide(tonerBase, osmBase).addTo(map);
        
    //call getMarkers function
    getMarkers(map);
}


// calc symbol radius
function calcPropRadius(attValue) {
	//scale factor to adjust symbol size evenly
	var scaleFactor = 5;
	//area based on attribute value and scale factor
	var area = attValue * scaleFactor;
	//radius calculated based on area
	var radius = Math.sqrt(area / Math.PI);
     
	return radius;
}


function Popup(properties, attribute, layer, radius){
    this.properties = properties;
    this.attribute = attribute;
    this.layer = layer;
    this.content = "<p>Breweries open in <b>" + this.properties.STATE + "</b> during " + attribute + ": <b>" + this.properties[attribute] + "</b></p>";
    
    this.bindToLayer = function(){
        this.layer.bindPopup(this.content, {
            offset: new L.Point(0,-radius)
        });
    };
}

//convert markers to circle markers
function pointToLayer(feature, latlng, attributes){
    //assign options based on index in attributes array
    var attribute = attributes[0];
    
    //marker options
    var options = {
        fillColor: "#FEB24C",
        color: "#ffffff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8       
    };

    //determine value for each feature
    var attValue = Number(feature.properties[attribute]);

    //determine value for each feature
    options.radius = calcPropRadius(attValue);

    //make circle marker layer
    var layer = L.circleMarker(latlng, options);
    
    var popup = new Popup(feature.properties, attribute, layer, options.radius);
    popup.bindToLayer();
    
    //return circle marker to L.geoJSON pointToLayer option
    return layer;

};

//build array
function processData(data){
    var attributes = [];
    
    //properties of the first feature in the dataset
    var properties = data.features[0].properties;
    
    //push each attribute name into attributes array
    for (var attribute in properties){
        //only take attributes with year starting "20" or "19"
        if (attribute.indexOf("20") > -1){
            attributes.push(attribute)
        };
        if (attribute.indexOf("19") > -1){
            attributes.push(attribute)
        };
    };
    
    return attributes;
}

//add markers for point features
function createPropSymbols(data, map, attributes){
    //create a Leaflet GeoJSON layer and add it to the map
    L.geoJson(data, {
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, attributes);
        }        
    }).addTo(map);
};

//resize proportional symbols
function updatePropSymbols(map, attribute){
    map.eachLayer(function(layer){
        if (layer.feature && layer.feature.properties[attribute]){
            //access feature properties
            var props = layer.feature.properties;
            
            //update feature radius from new att val
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);
            
            var popup = new Popup(props, attribute, layer, radius);
            
            //add popup to circle marker
            popup.bindToLayer();
        };
    }); 
    
    updateLegend(map, attribute);
};
     
function createLegend(map, attributes){
    var LegendControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function(map) {
            // create legend-control-container 
            var container = L.DomUtil.create('div', 'legend-control-container');

            //add temporal legend div to container
            $(container).append('<div id="temporal-legend">')
            
            var svg = '<svg id ="attribute-legend" width="200px" height="120px">';
            
            //circles object
            var circles = {
                max: 40,
                mean: 70, 
                min: 100
            };
            
            //loop to add each circle and text to svg string
            for (var circle in circles){
                //circle string
                svg += '<circle class="legend-circle" id="' + circle + 
                    '" fill="#FEB24C" fill-opacity="0.8" stroke="#000000" cx="50"/>';
            
                
                //text string
                svg += '<text id="' + circle + '-text" x="105" y="' + circles[circle] + '"></text>';
            }; 
            
            //close svg string
            svg += "</svg>";
            
            //add to container
            $(container).append(svg);
            
            return container;
        }
    });

    map.addControl(new LegendControl());
    updateLegend(map, attributes[0]);
};


function updateLegend(map, attribute){
    //create legend content
    var year = attribute;
    var content = "<b>US Breweries in " + year + "</b><br>[highest, avg, lowest]";
    
    //update legend content
    $('#temporal-legend').html(content);
    
    var circleValues = getCircleValues(map, attribute);
    
    for (var key in circleValues){
        //get the radius
        var radius = calcPropRadius(circleValues[key]);
        
        //assign cy, r attributes
        $('#'+key).attr({
            cy: 99 - radius,
            r: radius
        });
        
        //add legend text
        $('#'+key+'-text').text((circleValues[key]) + " breweries");
    
    };
    
};

function getCircleValues(map, attribute){
    //set values as high/low as possible
    var min = Infinity,
        max = -Infinity;
    
    map.eachLayer(function(layer){
        if (layer.feature){
           var attributeValue = Number(layer.feature.properties[attribute]);
        
        //test for min
        if (attributeValue < min){
            min = attributeValue;
        };
        
        //tet for max
        if (attributeValue > max){
            max = attributeValue;
        };
      };
    });
    
    //set mean
    var mean = (max + min) /2;
    
    //return values as an object
    return {
        max: max,
        min: min,
        mean: mean
    };
};


//sequence controls
function createSequenceControls(map, attributes){
    var SequenceControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },
        
        onAdd: function(map) {
        //create control container div with particular class name
        var container = L.DomUtil.create('div', 'sequence-control-container');
        
        //create range input element (slider)
        $(container).append('<input class="range-slider" type="range">');
        
        //add skip buttons
        $(container).append('<button class="skip" id="reverse" title="Reverse">Reverse</button>');
        $(container).append('<button class="skip" id="forward" title="Forward">Skip</button>');

        //disable mouse event listeners for the container
        L.DomEvent.disableClickPropagation(container);

        return container;
        
        }
    });
    
    map.addControl(new SequenceControl());
        
        //set slider attributes
        $('.range-slider').attr({
            max: 35,
            min: 0,
            value: 0,
            step: 1
        });
    
        //replace buttons with images
        $('#reverse').html('<img src="img/reverse.png">');
        $('#forward').html('<img src="img/forward.png">');
    
        //click listener for buttons
        //listen for buttons
        $('.skip').click(function(){
            
            //get old index value
            var index = $('.range-slider').val();

            if ($(this).attr('id') == 'forward'){
                index++;
            //if past final attribute, wrap to first
                index == index > 35 ? 0 : index;
            } else if ($(this).attr('id') == 'reverse'){
                index--;
                //if past first attribute, wrap to last
                index = index < 0 ? 35 : index;
            };
        
            //update slider
            $('.range-slider').val(index);
            
            //pass new attribute to update symbols
            updatePropSymbols(map, attributes[index]);
    });
    
        
    //listen for slider
    $('.range-slider').on('input', function(){
        //get new index value
        var index = $(this).val();
        
        //pass new val to update symbols
        updatePropSymbols(map, attributes[index]);
    });
};


//retrieve data 
function getMarkers(map){
    //load point data
    $.ajax("data/breweriesByState.geojson", {
        dataType: "json",
        success: function(response){
            //attribute array
            var attributes = processData(response);
            
            //call function to create proportional symbols
            createPropSymbols(response, map, attributes);
            createSequenceControls(map, attributes);
            createLegend(map, attributes);
        }
    });
};

$(document).ready(createMap)