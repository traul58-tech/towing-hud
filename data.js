const DEFAULT_TOWING_DATA = {
    "vehicles":  [
                     {
                         "id":  "lc300-sahara",
                         "name":  "LC300 Sahara",
                         "tare":  2630,
                         "gvm":  3280,
                         "gcm":  6750,
                         "maxTbm":  350,
                         "wheelbase":  2.85,
                         "overhang":  1.22,
                         "rearAxleTare":  1410,
                         "frontAxleTare":  1220,
                         "maxRearAxle":  1920,
                         "maxFrontAxle":  1630
                     },
                     {
                         "id":  "nissan-patrol-y62",
                         "name":  "Nissan Patrol Y62",
                         "tare":  2800,
                         "gvm":  3500,
                         "gcm":  7000,
                         "maxTbm":  350,
                         "wheelbase":  3.07,
                         "overhang":  1.34,
                         "rearAxleTare":  1540,
                         "frontAxleTare":  1260,
                         "maxRearAxle":  2030,
                         "maxFrontAxle":  1650
                     },
                     {
                         "id":  "toyota-hilux-rogue",
                         "name":  "Toyota Hilux Rogue",
                         "tare":  2240,
                         "gvm":  3050,
                         "gcm":  5850,
                         "maxTbm":  350,
                         "wheelbase":  3.08,
                         "overhang":  1.25,
                         "rearAxleTare":  1010,
                         "frontAxleTare":  1230,
                         "maxRearAxle":  1920,
                         "maxFrontAxle":  1350
                     },
                     {
                         "id":  "isuzu-d-max-x-terrain",
                         "name":  "Isuzu D-Max X-Terrain",
                         "tare":  2045,
                         "gvm":  3100,
                         "gcm":  6000,
                         "maxTbm":  350,
                         "wheelbase":  3.12,
                         "overhang":  1.28,
                         "rearAxleTare":  995,
                         "frontAxleTare":  1050,
                         "maxRearAxle":  1910,
                         "maxFrontAxle":  1450
                     },
                     {
                         "id":  "next-gen-ranger-wildtrak",
                         "name":  "Next-Gen Ranger Wildtrak",
                         "tare":  2345,
                         "gvm":  3350,
                         "gcm":  6400,
                         "maxTbm":  350,
                         "wheelbase":  3.27,
                         "overhang":  1.36,
                         "rearAxleTare":  1044,
                         "frontAxleTare":  1301,
                         "maxRearAxle":  1959,
                         "maxFrontAxle":  1490
                     },
                     {
                         "id":  "mazda-bt-50-sp-3-0l",
                         "name":  "Mazda BT-50 SP (3.0L)",
                         "tare":  2035,
                         "gvm":  3100,
                         "gcm":  6000,
                         "maxTbm":  350,
                         "wheelbase":  3.12,
                         "overhang":  1.29,
                         "rearAxleTare":  990,
                         "frontAxleTare":  1045,
                         "maxRearAxle":  1910,
                         "maxFrontAxle":  1450
                     },
                     {
                         "id":  "toyota-landcruiser-200",
                         "name":  "Toyota LandCruiser 200",
                         "tare":  2740,
                         "gvm":  3350,
                         "gcm":  6850,
                         "maxTbm":  350,
                         "wheelbase":  2.85,
                         "overhang":  1.21,
                         "rearAxleTare":  1450,
                         "frontAxleTare":  1290,
                         "maxRearAxle":  1950,
                         "maxFrontAxle":  1630
                     },
                     {
                         "id":  "toyota-landcruiser-100",
                         "name":  "Toyota LandCruiser 100",
                         "tare":  2520,
                         "gvm":  3260,
                         "gcm":  6760,
                         "maxTbm":  350,
                         "wheelbase":  2.85,
                         "overhang":  1.19,
                         "rearAxleTare":  1320,
                         "frontAxleTare":  1200,
                         "maxRearAxle":  1950,
                         "maxFrontAxle":  1300
                     },
                     {
                         "id":  "landcruiser-prado-250-series",
                         "name":  "LandCruiser Prado 250 Series",
                         "tare":  2410,
                         "gvm":  3100,
                         "gcm":  6600,
                         "maxTbm":  350,
                         "wheelbase":  2.85,
                         "overhang":  1.2,
                         "rearAxleTare":  1280,
                         "frontAxleTare":  1130,
                         "maxRearAxle":  1800,
                         "maxFrontAxle":  1450
                     },
                     {
                         "id":  "toyota-hilux-sr5-2-8l",
                         "name":  "Toyota Hilux SR5 (2.8L)",
                         "tare":  2100,
                         "gvm":  3050,
                         "gcm":  5850,
                         "maxTbm":  350,
                         "wheelbase":  3.08,
                         "overhang":  1.25,
                         "rearAxleTare":  1010,
                         "frontAxleTare":  1090,
                         "maxRearAxle":  1920,
                         "maxFrontAxle":  1350
                     },
                     {
                         "id":  "mitsubishi-triton-next-gen-mv",
                         "name":  "Mitsubishi Triton (Next-Gen MV)",
                         "tare":  2010,
                         "gvm":  3200,
                         "gcm":  6205,
                         "maxTbm":  350,
                         "wheelbase":  3.13,
                         "overhang":  1.27,
                         "rearAxleTare":  960,
                         "frontAxleTare":  1050,
                         "maxRearAxle":  1985,
                         "maxFrontAxle":  1450
                     },
                     {
                         "id":  "isuzu-d-max-3-0l",
                         "name":  "Isuzu D-MAX (3.0L)",
                         "tare":  2045,
                         "gvm":  3100,
                         "gcm":  6000,
                         "maxTbm":  350,
                         "wheelbase":  3.12,
                         "overhang":  1.28,
                         "rearAxleTare":  995,
                         "frontAxleTare":  1050,
                         "maxRearAxle":  1910,
                         "maxFrontAxle":  1450
                     }
                 ],
    "caravans":  [
                     {
                         "id":  "tandem-van",
                         "name":  "Tandem Van",
                         "tareTbm":  200,
                         "tare":  2780,
                         "atm":  3480,
                         "hitchDist":  5,
                         "maxGtm":  3280
                     },
                     {
                         "id":  "single-axle-van",
                         "name":  "Single Axle Van",
                         "tareTbm":  140,
                         "tare":  1850,
                         "atm":  2500,
                         "hitchDist":  4.2,
                         "maxGtm":  2360
                     },
                     {
                         "id":  "trailer-camper",
                         "name":  "Trailer Camper",
                         "tareTbm":  50,
                         "tare":  450,
                         "atm":  750,
                         "hitchDist":  2.8,
                         "maxGtm":  700
                     }
                 ],
    "inventory":  [
                      {
                          "name":  "Person 1",
                          "itemWeight":  83,
                          "travelWeight":  83,
                          "category":  "Vehicle Cabin Cargo",
                          "zone":  "cabin",
                          "packed":  true
                      },
                      {
                          "name":  "Person 2",
                          "itemWeight":  78,
                          "travelWeight":  78,
                          "category":  "Vehicle Cabin Cargo",
                          "zone":  "cabin",
                          "packed":  true
                      },
                      {
                          "name":  "Beer (14kg/Block)",
                          "itemWeight":  28,
                          "travelWeight":  28,
                          "category":  "Vehicle Cabin Cargo",
                          "zone":  "cabin",
                          "packed":  true
                      },
                      {
                          "name":  "Wine (6 Bottles) 8kg",
                          "itemWeight":  16,
                          "travelWeight":  16,
                          "category":  "Vehicle Cabin Cargo",
                          "zone":  "cabin",
                          "packed":  true
                      },
                      {
                          "name":  "Blue Tool Box",
                          "itemWeight":  10.4,
                          "travelWeight":  10.4,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "Water Bladder",
                          "itemWeight":  4.5,
                          "travelWeight":  4.5,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "Portable Fridge",
                          "itemWeight":  10,
                          "travelWeight":  10,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "3x10Ltr Diesel container",
                          "itemWeight":  3,
                          "travelWeight":  30,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "2x10Ltr Water container",
                          "itemWeight":  2,
                          "travelWeight":  20,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "Gravel Flaps",
                          "itemWeight":  5.5,
                          "travelWeight":  5.5,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "Chainsaw",
                          "itemWeight":  3,
                          "travelWeight":  3,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "Recovery Gear Bag",
                          "itemWeight":  11.2,
                          "travelWeight":  11.2,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "Tool Roll",
                          "itemWeight":  3,
                          "travelWeight":  3,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "Spare Stone Flaps",
                          "itemWeight":  3,
                          "travelWeight":  3,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "Beer (14kg/Block)",
                          "itemWeight":  14,
                          "travelWeight":  14,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  false
                      },
                      {
                          "name":  "Wine (6 Bottles) 8kg",
                          "itemWeight":  8,
                          "travelWeight":  8,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  false
                      },
                      {
                          "name":  "Generator",
                          "itemWeight":  23,
                          "travelWeight":  23,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "Fuel",
                          "itemWeight":  4,
                          "travelWeight":  4,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  true
                      },
                      {
                          "name":  "BBQ",
                          "itemWeight":  10.7,
                          "travelWeight":  10.7,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  false
                      },
                      {
                          "name":  "BBQ Tool box",
                          "itemWeight":  5.5,
                          "travelWeight":  5.5,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  false
                      },
                      {
                          "name":  "Moulded Table",
                          "itemWeight":  6.8,
                          "travelWeight":  6.8,
                          "category":  "Vehicle Utility Tub",
                          "zone":  "tub",
                          "packed":  false
                      },
                      {
                          "name":  "Bath towels/Bedding",
                          "itemWeight":  3.7,
                          "travelWeight":  3.7,
                          "category":  "Bathroom \u0026 Linen",
                          "zone":  "rearStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Bath stuff/Cleaning",
                          "itemWeight":  9.5,
                          "travelWeight":  9.5,
                          "category":  "Bathroom \u0026 Linen",
                          "zone":  "rearStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Toilet stuff",
                          "itemWeight":  7.3,
                          "travelWeight":  7.3,
                          "category":  "Bathroom \u0026 Linen",
                          "zone":  "rearStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Solar Panel Frame",
                          "itemWeight":  8,
                          "travelWeight":  8,
                          "category":  "Bathroom \u0026 Linen",
                          "zone":  "rearStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Solar Panel (new)",
                          "itemWeight":  16,
                          "travelWeight":  16,
                          "category":  "Bathroom \u0026 Linen",
                          "zone":  "rearStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Ext Leads",
                          "itemWeight":  3.8,
                          "travelWeight":  3.8,
                          "category":  "Rear External",
                          "zone":  "rearStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Rubbish bag",
                          "itemWeight":  2.5,
                          "travelWeight":  2.5,
                          "category":  "Rear External",
                          "zone":  "rearStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Gen Fuel",
                          "itemWeight":  4,
                          "travelWeight":  4,
                          "category":  "Rear External",
                          "zone":  "rearStorage",
                          "packed":  false
                      },
                      {
                          "name":  "Water Container (Rear)",
                          "itemWeight":  2,
                          "travelWeight":  20,
                          "category":  "Rear External",
                          "zone":  "rearStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Water Transfer pump",
                          "itemWeight":  4.4,
                          "travelWeight":  4.4,
                          "category":  "Rear External",
                          "zone":  "rearStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Generator",
                          "itemWeight":  23,
                          "travelWeight":  23,
                          "category":  "Rear External",
                          "zone":  "rearStorage",
                          "packed":  false
                      },
                      {
                          "name":  "Kettle, Bags, Binoculars, P/Towel",
                          "itemWeight":  3.8,
                          "travelWeight":  3.8,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Cutlery tray",
                          "itemWeight":  2.6,
                          "travelWeight":  2.6,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Crockery/Coffee,Tea,Sugar",
                          "itemWeight":  7.7,
                          "travelWeight":  7.7,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Foil trays, P/Towel,Container",
                          "itemWeight":  1.7,
                          "travelWeight":  1.7,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Glasses/Utensils",
                          "itemWeight":  3.5,
                          "travelWeight":  3.5,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Toaster/snackle/picture/bottle",
                          "itemWeight":  2,
                          "travelWeight":  2,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Pots/Cleaning stuff",
                          "itemWeight":  3,
                          "travelWeight":  3,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Rubbish bin/Trays",
                          "itemWeight":  2,
                          "travelWeight":  2,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Cooker/Air Tray",
                          "itemWeight":  2.3,
                          "travelWeight":  2.3,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Fry Pan/Tray",
                          "itemWeight":  2.5,
                          "travelWeight":  2.5,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Cleaning tray/Boil kettle",
                          "itemWeight":  1.7,
                          "travelWeight":  1.7,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Fry Pan/Steps",
                          "itemWeight":  1,
                          "travelWeight":  1,
                          "category":  "Kitchen Internal",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Fridge food",
                          "itemWeight":  30,
                          "travelWeight":  30,
                          "category":  "Dining \u0026 Pantry",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Pantry Food",
                          "itemWeight":  20,
                          "travelWeight":  20,
                          "category":  "Dining \u0026 Pantry",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Games/Mozzie Stuff",
                          "itemWeight":  4,
                          "travelWeight":  4,
                          "category":  "Dining \u0026 Pantry",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Vac Cleaner",
                          "itemWeight":  1.2,
                          "travelWeight":  1.2,
                          "category":  "Dining \u0026 Pantry",
                          "zone":  "midStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Clothes",
                          "itemWeight":  20,
                          "travelWeight":  20,
                          "category":  "Bedroom Front",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Diesel Heater",
                          "itemWeight":  2.2,
                          "travelWeight":  2.2,
                          "category":  "Bedroom Front",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "BBQ Tool Box",
                          "itemWeight":  5.5,
                          "travelWeight":  5.5,
                          "category":  "Bedroom Front",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Moulded Table (new)",
                          "itemWeight":  4.1,
                          "travelWeight":  4.1,
                          "category":  "Bedroom Front",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Van Ramps",
                          "itemWeight":  3,
                          "travelWeight":  3,
                          "category":  "Bedroom Front",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Tarp/Floor",
                          "itemWeight":  6,
                          "travelWeight":  6,
                          "category":  "Bedroom Front",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Jockey Stand",
                          "itemWeight":  2.5,
                          "travelWeight":  2.5,
                          "category":  "Bedroom Front",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Spare Toilet Cassette (empty)",
                          "itemWeight":  2.7,
                          "travelWeight":  2.7,
                          "category":  "Tunnel Boot",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Camp Chairs",
                          "itemWeight":  7.4,
                          "travelWeight":  7.4,
                          "category":  "Tunnel Boot",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Awning Roof poles/Broom",
                          "itemWeight":  7,
                          "travelWeight":  7,
                          "category":  "Tunnel Boot",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Camp Fire",
                          "itemWeight":  3.5,
                          "travelWeight":  3.5,
                          "category":  "Tunnel Boot",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Table",
                          "itemWeight":  4.5,
                          "travelWeight":  4.5,
                          "category":  "Tunnel Boot",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "BBQ",
                          "itemWeight":  10.7,
                          "travelWeight":  10.7,
                          "category":  "Tunnel Boot",
                          "zone":  "frontStorage",
                          "packed":  true
                      },
                      {
                          "name":  "Diesel Heater Fuel",
                          "itemWeight":  8,
                          "travelWeight":  8,
                          "category":  "A-Frame Left",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Peg/Strap Bag",
                          "itemWeight":  4.2,
                          "travelWeight":  4.2,
                          "category":  "A-Frame Left",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Van Accessory bag",
                          "itemWeight":  2.5,
                          "travelWeight":  2.5,
                          "category":  "A-Frame Left",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Van Step and Small Table",
                          "itemWeight":  3.6,
                          "travelWeight":  3.6,
                          "category":  "A-Frame Left",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Steps",
                          "itemWeight":  3,
                          "travelWeight":  3,
                          "category":  "A-Frame Left",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Navigator Spade/Cover",
                          "itemWeight":  2,
                          "travelWeight":  2,
                          "category":  "A-Frame Left",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "9kg Gas Bottle",
                          "itemWeight":  8.5,
                          "travelWeight":  8.5,
                          "category":  "A-Frame Left",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "9kg Gas Bottle",
                          "itemWeight":  8.5,
                          "travelWeight":  8.5,
                          "category":  "A-Frame Left",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Water Bucket \u0026Dustpan",
                          "itemWeight":  1,
                          "travelWeight":  1,
                          "category":  "A-Frame Right",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Water Transfer pump",
                          "itemWeight":  4.4,
                          "travelWeight":  4.4,
                          "category":  "A-Frame Right",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Water/Waste Hoses",
                          "itemWeight":  5,
                          "travelWeight":  5,
                          "category":  "A-Frame Right",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Water Accessory bag",
                          "itemWeight":  2,
                          "travelWeight":  2,
                          "category":  "A-Frame Right",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Screens",
                          "itemWeight":  5.8,
                          "travelWeight":  5.8,
                          "category":  "A-Frame Right",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Ladder",
                          "itemWeight":  6.2,
                          "travelWeight":  6.2,
                          "category":  "A-Frame Right",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "Muk Mats",
                          "itemWeight":  2,
                          "travelWeight":  2,
                          "category":  "A-Frame Right",
                          "zone":  "aFrame",
                          "packed":  true
                      },
                      {
                          "name":  "TBM Gauge \u0026 Tools",
                          "itemWeight":  8.6,
                          "travelWeight":  8.6,
                          "category":  "A-Frame Right",
                          "zone":  "aFrame",
                          "packed":  true
                      }
                  ]
};
