import random
from datetime import datetime, timedelta, timezone
from backend.database import SessionLocal, init_db
from backend.models import VesselTransit, classify_vessel, estimate_cargo_barrels, infer_direction, HORMUZ_BBOX

def seed_mock_data():
    init_db()
    db = SessionLocal()
    
    # Check if we already have data
    if db.query(VesselTransit).count() > 10:
        print("Data already exists. Skipping seed.")
        db.close()
        return

    print("Seeding mock vessel transits...")
    
    names = ["MARAN GAS APOLLONIA", "SEAWOLF", "FRONT ALTAIR", "KOKUKA COURAGEOUS", "STENA IMPERO", "ADVANTAGE SWEET"]
    mmsis = ["241474000", "311000854", "538008272", "374633000", "232022414", "538010156"]
    
    now = datetime.now(timezone.utc)
    
    for i in range(20):
        mmsi = random.choice(mmsis)
        name = names[mmsis.index(mmsi)]
        
        # Random position in HORMUZ_BBOX
        lat = random.uniform(HORMUZ_BBOX["lat_min"], HORMUZ_BBOX["lat_max"])
        lon = random.uniform(HORMUZ_BBOX["lon_min"], HORMUZ_BBOX["lon_max"])
        
        course = random.uniform(0, 360)
        speed = random.uniform(0.1, 15.0)
        vessel_type = random.choice([80, 81, 84, 71]) # Tankers and LNG
        
        dwt = 150_000 if vessel_type == 84 else 100_000
        vessel_class = classify_vessel(dwt, vessel_type)
        
        # Draught 10-15m
        draught = random.uniform(8.0, 16.0)
        max_draught = 16.0
        
        is_loaded, barrels = estimate_cargo_barrels(dwt, draught, max_draught)
        direction = infer_direction(course, lon)
        
        transit = VesselTransit(
            mmsi=mmsi,
            vessel_name=name,
            vessel_type=vessel_type,
            vessel_class=vessel_class,
            dwt=dwt,
            latitude=lat,
            longitude=lon,
            speed=speed,
            course=course,
            draught=draught,
            max_draught=max_draught,
            is_loaded=is_loaded,
            estimated_barrels=barrels,
            direction=direction,
            observed_at=now - timedelta(minutes=random.randint(0, 120))
        )
        db.add(transit)
    
    db.commit()
    print(f"Seed complete. Total transits: {db.query(VesselTransit).count()}")
    db.close()

if __name__ == "__main__":
    seed_mock_data()
