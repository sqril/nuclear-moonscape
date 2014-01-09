function Timeline(_startYear, _endYear, _periodInt, _eventYears)
{

	var _intevalCount = ((_endYear - _startYear) / _periodInt);
	var _index = 0;
	
	$(window).resize(function(){
		resizeTimeline();
	});
	
	$(document).ready(function(){
		createTimeline();
		$(".handle").draggable({
			cursor: "default",
			axis: "y",
			containment: "parent",
			stop: function() {
				_index = findClosestPeriod(parseInt($(".handle").css("top")));
				situate(_index);
			},
			drag: function(event, ui) {
				// put limiters on handle y's
				// var top = parseInt($(".handle").css("top"));
				// if (top < 5) $(".handle").css("top", "5px");
			}
		});
		situate(_index);
		$(".period-bar").click(function(e) {
			_index = $.inArray(e.currentTarget, $(".period-bar"));
			situate(_index);
		});		
	});
	
	function createTimeline()
	{
		for (var i = 0; i < _intevalCount; i++){
			$("#timeline").append('<div class="period-wrapper">\
				' + (i === 0 ? '<div class="period-year first-year">' + _startYear + '</div>' : '') + '\
				<div class="period-bar"></div>\
				' + (i === _intevalCount - 1 ? '<div class="period-year last-year">' + (_startYear + (_periodInt * (i + 1))) + '</div>' : '<div class="period-year">' + (_startYear + (_periodInt * (i + 1))) + '</div>') + '\
			</div>');
		}
	
		$("#timeline").append("<div class='handle'></div>");
	
		for (var j = 0; j < _eventYears.length; j++){
			var calc = _eventYears[j].year - _startYear,
				period = Math.floor(calc/_periodInt),
				offset = ((calc % _periodInt)/_periodInt) * 100;
	
				$(".period-wrapper").eq(period).append('<div class="event-wrapper" style="top: ' + offset + '%;' + (offset === 0 ? 'margin-top: -11px;' : '') + '">\
					<div class="year-text">' + _eventYears[j].year + '</div>\
					<div class="arrow-block"></div>\
					<div class="arrow-outline"></div>\
					<div class="arrow-main"></div>\
				</div>');
		}
		
		resizeTimeline();
			
	}
	
	function resizeTimeline()
	{
		$(".period-wrapper").css({
			"height": Math.floor((($("#timeline").outerHeight() - 5)/_intevalCount) - 5)
		});
		$(".handle").height($(".period-bar").height()); 
		situate(_index);
	}
	
	function findClosestPeriod(handleTop)
	{
	
		var minDiff = Number.MAX_VALUE;
		var diff;
		var closest;
		
		for (var i = 0; i < $(".period-wrapper").length; i++) {
			diff = Math.abs(handleTop - calcTop(i));
			if (diff < minDiff) {
				minDiff = diff;
				closest = i;
			}
		}
		
		return closest;
	
	}
	
	function situate(index)
	{
		// move the handle to where it's supposed to be, based on current
		// _index.
		$(".handle").animate({top: calcTop(index)}, "linear", function(){
			// to do: whatever needs to be done after handle has situated.
		});
	}
	
	function calcTop(index)
	{
		return $(".period-wrapper").eq(index).position().top + parseInt($(".period-wrapper").css("margin-top"));
	}
	
	this.stepUp = function()
	{
		_index--;
		if (_index < 0) _index = 0;
		situate(_index);	
	}
	
	this.stepDown = function()
	{
		_index++;
		if (_index > $(".period-wrapper").length - 1) _index = $(".period-wrapper").length - 1;
		situate(_index);	
	}
	
}
