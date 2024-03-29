queue()
    .defer(d3.csv, "data/Salaries.csv")
    .await(makeGraphs);
    
function makeGraphs(error, salaryData) {
    var ndx = crossfilter(salaryData);
    
    salaryData.forEach(function(d){
        d.salary = parseInt(d.salary);
        d.yrs_since_phd = parseInt(d["yrs.since.phd"])
        d.yrs_service = parseInt(d["yrs.service"])
    });
    
    show_discipline_selector(ndx);
    
    show_percent_that_are_professors(ndx, "Female", "#percent-of-women-professors");
    show_percent_that_are_professors(ndx, "Male", "#percent-of-men-professors");
    
    show_gender_balance(ndx);
    show_average_salary(ndx);
    show_rank_distribution(ndx);

    show_service_to_salary_correlation(ndx);

    show_phd_to_salary_correlation(ndx);
    
    dc.renderAll();
}


//  ----------------------------------------------------------------------------------DISCIPLINE SELECTOR
function show_discipline_selector(ndx) {
    var dim = ndx.dimension(dc.pluck('discipline'));
    var group = dim.group();
    
    dc.selectMenu("#discipline-selector")
        .dimension(dim)
        .group(group);
}
//  ----------------------------------------------------------------------------------/DISCIPLINE SELECTOR

//  ----------------------------------------------------------------------------------PERCENTAGE DISPLAY
function show_percent_that_are_professors(ndx, gender, element) {
    var percentageThatAreProf = ndx.groupAll().reduce(
        function(p, v) {
            if (v.sex === gender) {
                p.count++;
                if(v.rank === "Prof") {
                    p.are_prof++;
                }
            }
            return p;
        },
        function(p, v) {
            if (v.sex === gender) {
                p.count--;
                if(v.rank === "Prof") {
                    p.are_prof--;
                }
            }
            return p;
        },
        function() {
            return {count: 0, are_prof: 0};    
        },
    );
    
    dc.numberDisplay(element)
        .formatNumber(d3.format(".2%"))
        .valueAccessor(function (d) {
            if (d.count == 0) {
                return 0;
            } else {
                return (d.are_prof / d.count);
            }
        })
        .group(percentageThatAreProf)
}
//  ----------------------------------------------------------------------------------/PERCENTAGE DISPLAY



function show_gender_balance(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    var group = dim.group();
    
    dc.barChart("#gender-balance")
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(group)
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .yAxis().ticks(20);
}

//  ----------------------------------------------------------------------------------AVERAGES BAR CHART
function show_average_salary(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    
    function add_item(p, v) {
        p.count++;
        p.total += v.salary;
        p.average = p.total / p.count;
        return p;
    }

    function remove_item(p, v) {
        p.count--;
        if(p.count == 0) {
            p.total = 0;
            p.average = 0;
        } else {
            p.total -= v.salary;
            p.average = p.total / p.count;
        }
        return p;
    }
    
    function initialise() {
        return {count: 0, total: 0, average: 0};
    }

    var averageSalaryByGender = dim.group().reduce(add_item, remove_item, initialise);

    dc.barChart("#average-salary")
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(averageSalaryByGender)
        .valueAccessor(function(d){
            return d.value.average.toFixed(2);
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .elasticY(true)
        .xAxisLabel("Gender")
        .yAxis().ticks(4);
}
//  ----------------------------------------------------------------------------------/AVERAGES BAR CHART

//  ----------------------------------------------------------------------------------DISTRIBUTED BAR CHART
function show_rank_distribution(ndx) {
    
    function rankByGender(dimension, rank) {
        return dimension.group().reduce(
            function (p, v) {
                p.total++;
                if(v.rank == rank) {
                    p.match++;
                }
                return p;
            },
            function (p, v) {
                p.total--;
                if(v.rank == rank) {
                    p.match--;
                }
                return p;
            },
            function () {
                return {total: 0, match: 0};
            }
        );
    }
    
    var dim = ndx.dimension(dc.pluck("sex"));
    var profByGender = rankByGender(dim, "Prof");
    var asstProfByGender = rankByGender(dim, "AsstProf");
    var assocProfByGender = rankByGender(dim, "AssocProf");
    
    dc.barChart("#rank-distribution")
        .width(350)
        .height(250)
        .dimension(dim)
        .group(profByGender, "Prof")
        .stack(asstProfByGender, "Asst Prof")
        .stack(assocProfByGender, "Assoc Prof")
        .valueAccessor(function(d) {
            if(d.value.total > 0) {
                return (d.value.match / d.value.total) * 100;
            } else {
                return 0;
            }
        })
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .legend(dc.legend().x(265).y(20).itemHeight(15).gap(5))
        .margins({top: 10, right: 100, bottom: 30, left: 30});
}
//  ----------------------------------------------------------------------------------/DISTRIBUTED BAR CHART


//  ----------------------------------------------------------------------------------SCATTER PLOT
function show_service_to_salary_correlation(ndx) {
    
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);
    
    var serviceFrameDim = ndx.dimension(dc.pluck("yrs_service"));                     //This will be used to work out the bounds of years of sevice
    var experienceDim = ndx.dimension(function(d) {
        return [d.yrs_service, d.salary, d.rank ,d.sex];                              //The first parameter will plot along the x-axis, the second the y-axis, the 3rd is for use in the title, the 4th will be used to color correlating to genders
    });
    var experienceSalaryGroup = experienceDim.group();

    var minExperience = serviceFrameDim.bottom(1)[0].yrs_service;
    var maxExperience = serviceFrameDim.top(1)[0].yrs_service;                         //This will use serviceFrameDim to get min and max years of service

    dc.scatterPlot("#service-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minExperience, maxExperience]))                    //Note this is linear, not odinal as before
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)                                                                //Leaves room at the top of chart for any dots near the top
        .xAxisLabel("Years Of Service")
        .yAxisLabel("Salary")
        .title(function(d) {
            return d.key[2] + " earned " + d.key[1];                                    //This will appear when a dot is hovered, we use [1], because the salary is the second from the array
        })
        .colorAccessor(function(d) {
            return d.key[3];                                                            //Sex is the 4th from array so we use [3] to grab the sex value, then use genderColors below, which we defined earlier as "pink" for female, and "blue" for male
        })
        .colors(genderColors)
        .dimension(experienceDim)                                                       //Contains both years of service and Salary
        .group(experienceSalaryGroup)                                                   
        .margins({top: 10, right: 50, bottom: 75, left: 75});

}

//  ----------------------------------------------------------------------------------/SCATTER PLOT

function show_phd_to_salary_correlation(ndx) {
    
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);
    
    var timeFrameDim = ndx.dimension(dc.pluck("yrs_since_phd"));                     //This will be used to work out the bounds of years since phd was acheived
    var phdDim = ndx.dimension(function(d) {
        return [d.yrs_since_phd, d.salary, d.rank ,d.sex];                              //The first parameter will plot along the x-axis, the second the y-axis, the 3rd is for use in the title, the 4th will be used to color correlating to genders
    });
    var phdSalaryGroup = phdDim.group();

    var minPhd = timeFrameDim.bottom(1)[0].yrs_since_phd;
    var maxPhd = timeFrameDim.top(1)[0].yrs_since_phd;                         //This will use serviceFrameDim to get min and max years of service

    dc.scatterPlot("#phd-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minPhd, maxPhd]))                    //Note this is linear, not odinal as before
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)                                                                //Leaves room at the top of chart for any dots near the top
        .xAxisLabel("Years Since Phd")
        .yAxisLabel("Salary")
        .title(function(d) {
            return d.key[2] + " earned " + d.key[1];                                    //This will appear when a dot is hovered, we use [1], because the salary is the second from the array
        })
        .colorAccessor(function(d) {
            return d.key[3];                                                            //Sex is the 4th from array so we use [3] to grab the sex value, then use genderColors below, which we defined earlier as "pink" for female, and "blue" for male
        })
        .colors(genderColors)
        .dimension(phdDim)                                                       //Contains both years of service and Salary
        .group(phdSalaryGroup)                                                   
        .margins({top: 10, right: 50, bottom: 75, left: 75});

}