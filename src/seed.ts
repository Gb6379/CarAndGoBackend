import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';

config();

export async function seedDatabase(dataSource?: DataSource) {
  console.log('🌱 Seeding database with test data...');

  let ds: DataSource;
  
  if (dataSource) {
    // Use provided DataSource (from main.ts)
    ds = dataSource;
  } else {
    // Create new DataSource (from command line)
    ds = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '12345678',
      database: process.env.DB_DATABASE || 'postgres',
    });
    
    try {
      await ds.initialize();
    } catch (error) {
      console.error('❌ Error connecting to database:', error);
      throw error;
    }
  }
  
  try {
    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create lessor user
    const lessorResult = await ds.query(`
      INSERT INTO users (
        "email", "password", "firstName", "lastName", "cpfCnpj", 
        "userType", "status", "phone", "city", "state"
      ) VALUES (
        'owner@test.com', $1, 'João', 'Silva', '12345678900',
        'lessor', 'active', '11999999999', 'São Paulo', 'SP'
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, [hashedPassword]);

    let lessorId;
    if (lessorResult.length > 0) {
      lessorId = lessorResult[0].id;
    } else {
      const existingLessor = await ds.query('SELECT id FROM users WHERE email = $1', ['owner@test.com']);
      lessorId = existingLessor[0].id;
    }

    // Create lessee user
    const lesseeResult = await ds.query(`
      INSERT INTO users (
        "email", "password", "firstName", "lastName", "cpfCnpj", 
        "userType", "status", "phone", "city", "state"
      ) VALUES (
        'customer@test.com', $1, 'Maria', 'Santos', '98765432100',
        'lessee', 'active', '11888888888', 'São Paulo', 'SP'
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, [hashedPassword]);

    let lesseeId;
    if (lesseeResult.length > 0) {
      lesseeId = lesseeResult[0].id;
    } else {
      const existingLessee = await ds.query('SELECT id FROM users WHERE email = $1', ['customer@test.com']);
      lesseeId = existingLessee[0].id;
    }

    console.log('✅ Test users created/found');
    console.log('   - Lessor ID:', lessorId);
    console.log('   - Lessee ID:', lesseeId);

    // Create test vehicles
    const vehicles = [
      {
        make: 'Toyota',
        model: 'Corolla',
        year: 2022,
        licensePlate: 'ABC-1234',
        type: 'sedan',
        fuelType: 'flex',
        engineCapacity: 1600,
        mileage: 15000,
        dailyRate: 150.00,
        hourlyRate: 25.00,
        status: 'active',
        address: 'Av. Paulista, 1000',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5614,
        longitude: -46.6558,
        color: 'Branco',
        transmission: 'Automático',
        seats: 5,
        airConditioning: true,
        gps: true,
        bluetooth: true,
        usbCharger: true,
        isActive: true,
        ownerId: lessorId
      },
      {
        make: 'Honda',
        model: 'Civic',
        year: 2023,
        licensePlate: 'DEF-5678',
        type: 'sedan',
        fuelType: 'flex',
        engineCapacity: 1800,
        mileage: 8000,
        dailyRate: 180.00,
        hourlyRate: 30.00,
        status: 'active',
        address: 'Rua Augusta, 500',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5505,
        longitude: -46.6631,
        color: 'Prata',
        transmission: 'Automático',
        seats: 5,
        airConditioning: true,
        gps: true,
        bluetooth: true,
        usbCharger: true,
        isActive: true,
        ownerId: lessorId
      },
      {
        make: 'Volkswagen',
        model: 'Gol',
        year: 2021,
        licensePlate: 'GHI-9012',
        type: 'hatchback',
        fuelType: 'flex',
        engineCapacity: 1000,
        mileage: 25000,
        dailyRate: 120.00,
        hourlyRate: 20.00,
        status: 'active',
        address: 'Av. Rebouças, 2000',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5679,
        longitude: -46.6745,
        color: 'Vermelho',
        transmission: 'Manual',
        seats: 5,
        airConditioning: true,
        gps: false,
        bluetooth: true,
        usbCharger: false,
        isActive: true,
        ownerId: lessorId
      },
      {
        make: 'Chevrolet',
        model: 'Onix',
        year: 2022,
        licensePlate: 'JKL-3456',
        type: 'hatchback',
        fuelType: 'flex',
        engineCapacity: 1200,
        mileage: 18000,
        dailyRate: 130.00,
        hourlyRate: 22.00,
        status: 'active',
        address: 'Rua da Consolação, 1500',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5475,
        longitude: -46.6510,
        color: 'Preto',
        transmission: 'Automático',
        seats: 5,
        airConditioning: true,
        gps: true,
        bluetooth: true,
        usbCharger: true,
        isActive: true,
        ownerId: lessorId
      },
      {
        make: 'Fiat',
        model: 'Uno',
        year: 2020,
        licensePlate: 'MNO-7890',
        type: 'hatchback',
        fuelType: 'flex',
        engineCapacity: 1000,
        mileage: 30000,
        dailyRate: 100.00,
        hourlyRate: 18.00,
        status: 'active',
        address: 'Av. Faria Lima, 3000',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5742,
        longitude: -46.6893,
        color: 'Azul',
        transmission: 'Manual',
        seats: 5,
        airConditioning: false,
        gps: false,
        bluetooth: false,
        usbCharger: false,
        isActive: true,
        ownerId: lessorId
      }
    ];

    for (const vehicle of vehicles) {
      await ds.query(`
        INSERT INTO vehicles (
          "make", "model", "year", "licensePlate", "type", "fuelType",
          "engineCapacity", "mileage", "dailyRate", "hourlyRate", "status",
          "address", "city", "state", "latitude", "longitude", "color",
          "transmission", "seats", "airConditioning", "gps", "bluetooth",
          "usbCharger", "isActive", "ownerId"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25
        )
        ON CONFLICT ("licensePlate") DO NOTHING
      `, [
        vehicle.make, vehicle.model, vehicle.year, vehicle.licensePlate,
        vehicle.type, vehicle.fuelType, vehicle.engineCapacity, vehicle.mileage,
        vehicle.dailyRate, vehicle.hourlyRate, vehicle.status, vehicle.address,
        vehicle.city, vehicle.state, vehicle.latitude, vehicle.longitude,
        vehicle.color, vehicle.transmission, vehicle.seats, vehicle.airConditioning,
        vehicle.gps, vehicle.bluetooth, vehicle.usbCharger, vehicle.isActive,
        vehicle.ownerId
      ]);
    }

    console.log('✅ Test vehicles created successfully!');
    console.log('📊 Total vehicles in database:', vehicles.length);
    
    // Show login credentials
    console.log('\n🔐 Test Account Credentials:');
    console.log('   Lessor (Owner): owner@test.com / password123');
    console.log('   Lessee (Customer): customer@test.com / password123');
    
    // Only destroy if we created the DataSource
    if (!dataSource) {
      await ds.destroy();
    }
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    
    // Only destroy if we created the DataSource
    if (!dataSource) {
      await ds.destroy();
      process.exit(1);
    } else {
      throw error;
    }
  }
}

// Only run if called directly (not imported)
if (require.main === module) {
  seedDatabase();
}
