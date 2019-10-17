var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var middleware = require("../middleware");
var NodeGeocoder = require("node-geocoder");
var options = {
    provider: "google",
    httpAdapter: "https",
    apiKey: process.env.GoogleAPIKey
};
var geocoder = NodeGeocoder(options);
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error("Sorry, only image files are allowed e.g. jpg/jpeg/png/gif"), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

var cloudinary = require("cloudinary");
cloudinary.config({ 
  cloud_name: "karanmakhija",
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// INDEX - show all campgrounds
router.get("/", function(req, res){
    // fuzzy search
    if(req.query.search){
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        // get all campgrounds from DB
        Campground.find({name: regex}, function(err, allCampgrounds){
            if(err){
                console.log(err);
            } else {
                if(allCampgrounds.length < 1){
                    req.flash("error", "No campgrounds match that query, please try again");
                    res.redirect("back");
                }
                res.render("campgrounds/index", {campgrounds: allCampgrounds, page: "campgrounds"});
            }
        });
    } else {
        // get all campgrounds from DB
        Campground.find({}, function(err, allCampgrounds){
            if(err){
                console.log(err);
            } else {
                res.render("campgrounds/index", {campgrounds: allCampgrounds, page: "campgrounds"});
            }
        });
    }
});

// CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single("image"), function(req, res){
   // get data from form and add to campgrounds array
   var name = req.body.name;
   var image = req.body.image;
   var cost = req.body.cost;
   var desc = req.body.description;
   var author = {
       id: req.user._id,
       username: req.user.username
   }
   geocoder.geocode(req.body.location, function(err, data, results, status){
       if(err || data.status === "ZERO_RESULTS") {
           req.flash("error", "Invalid address - try typing a new location");
           return res.redirect("back");
       }
       var lat = data[0].latitude;
       var lng = data[0].longitude;
       var location = data[0].formattedAddress;
       var newCampground = {name: name, image: image, cost: cost, description: desc, author: author, location: location, lat: lat, lng: lng};
       // create a new campground and save to DB
       Campground.create(newCampground, function(err, newlyCreated){
           if(err){
               req.flash("error", err.message);
               res.render("/", {error: err.message});
           } else {
               // redirect back to campgrounds page
               console.log(newlyCreated);
              res.redirect("/campgrounds"); // disable when using Cloudinary
           }
       });
       
    //   cloudinary.uploader.upload(req.file.path, function(result) {
    //       // add cloudinary url for the image to the campground object under image property
    //       req.body.campground.image = result.secure_url;
    //       // add author to campground
    //       req.body.campground.author = {
    //         id: req.user._id,
    //         username: req.user.username
    //       }
    //       Campground.create(req.body.campground, function(err, campground) {
    //         if (err) {
    //           req.flash("error", "Sorry, there was a problem creating your campground - please try again");
    //           return res.redirect("back");
    //         }
    //         res.redirect("/campgrounds/" + campground.id);
    //       });
    //     });
       
   });
});

// NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, function(req, res){
   res.render("campgrounds/new"); 
});

// SHOW - shows more info about one campground
router.get("/:id", function(req, res){
    // find campground with provided ID
    Campground.findById(req.params.id).populate("comments").exec(function(err, foundCampground){
        if(err || !foundCampground){
            req.flash("error", "Campground not found");
            res.redirect("back");
        } else {
            console.log(foundCampground);
            // render show template with that campground
            res.render("campgrounds/show", {campground: foundCampground});
        }
    });
});

// EDIT CAMPGROUND ROUTE
router.get("/:id/edit", middleware.checkCampgroundOwnership, function(req, res){
    Campground.findById(req.params.id, function(err, foundCampground){
        if(err){
            req.flash("error", "Sorry, campground not found!");
        }
        res.render("campgrounds/edit", {campground: foundCampground});
    });
});

// UPDATE CAMPGROUND ROUTE
router.put("/:id", middleware.checkCampgroundOwnership, function(req, res){
    geocoder.geocode(req.body.location, function(err, data){
        var lat = data[0].latitude
        var lng = data[0].longitude;
        var location = data[0].formattedAddress;
        var newData = {name: req.body.name, image: req.body.image, description: req.body.description, cost: req.body.cost, location: location, lat: lat, lng: lng};
        Campground.findByIdAndUpdate(req.params.id, {$set: newData}, function(err, campground){
            if(err){
                req.flash("error", err.message);
                res.redirect("back");
            } else {
                req.flash("success","Successfully Updated!");
                res.redirect("/campgrounds/" + campground._id);
            }
        });
   });
});

// DESTROY CAMPGROUND ROUTE
router.delete("/:id", middleware.checkCampgroundOwnership, function(req, res){
    Campground.findByIdAndRemove(req.params.id, function(err){
        if(err){
            res.redirect("/campgrounds");
        } else {
            res.redirect("/campgrounds");
        }
    });
});

// fuzzy search regular expression filter
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");  
};

module.exports = router;