import mongoose from 'mongoose';
import Room from './models/Room.js';
import dotenv from 'dotenv';

dotenv.config();

// Support both MONGO_URI and MONGODB_URI
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ Error: MONGO_URI or MONGODB_URI not found in .env file');
  console.error('Please add one of these to your .env file:');
  console.error('  MONGO_URI=mongodb://...');
  console.error('  or');
  console.error('  MONGODB_URI=mongodb://...');
  process.exit(1);
}

async function migrate() {
  try {
    console.log('🔄 Starting database migration...\n');
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: ${mongoose.connection.name}\n`);

    // Step 1: Update rooms without new fields
    console.log('Step 1: Adding default values to existing rooms...');
    const result1 = await Room.updateMany(
      { duration: { $exists: false } },
      { 
        $set: { 
          duration: 0,
          maxParticipants: 0,
          status: 'active'
        }
      }
    );
    console.log(`   ✅ Updated ${result1.modifiedCount} rooms with default values\n`);

    // Step 2: Update ended rooms to completed status
    console.log('Step 2: Updating ended rooms to completed status...');
    const result2 = await Room.updateMany(
      { ended: true, status: { $ne: 'completed' } },
      { $set: { status: 'completed' } }
    );
    console.log(`   ✅ Updated ${result2.modifiedCount} ended rooms to completed status\n`);

    // Step 3: Calculate duration for ended rooms
    console.log('Step 3: Calculating duration for completed rooms...');
    const endedRooms = await Room.find({ 
      ended: true, 
      endedAt: { $exists: true },
      duration: 0
    });

    let durationCount = 0;
    for (const room of endedRooms) {
      const duration = Math.round((room.endedAt - room.createdAt) / 60000);
      if (duration > 0) {
        room.duration = duration;
        await room.save();
        durationCount++;
      }
    }
    console.log(`   ✅ Calculated duration for ${durationCount} rooms\n`);

    // Step 4: Set maxParticipants to current count
    console.log('Step 4: Setting maxParticipants for existing rooms...');
    const allRooms = await Room.find({ maxParticipants: 0 });
    let participantCount = 0;
    for (const room of allRooms) {
      const count = room.participants?.length || 0;
      if (count > 0) {
        room.maxParticipants = count;
        await room.save();
        participantCount++;
      }
    }
    console.log(`   ✅ Set maxParticipants for ${participantCount} rooms\n`);

    // Step 5: Create indexes
    console.log('Step 5: Creating database indexes...');
    try {
      await Room.collection.createIndex({ status: 1, ended: 1 });
      await Room.collection.createIndex({ createdBy: 1, createdAt: -1 });
      await Room.collection.createIndex({ participants: 1 });
      await Room.collection.createIndex({ scheduledFor: 1 });
      await Room.collection.createIndex({ endedAt: -1 });
      console.log('   ✅ Created all indexes\n');
    } catch (err) {
      console.log('   ⚠️  Some indexes may already exist (this is OK)\n');
    }

    // Step 6: Verification
    console.log('Step 6: Verifying migration...');
    const totalRooms = await Room.countDocuments();
    const activeRooms = await Room.countDocuments({ status: 'active', ended: false });
    const completedRooms = await Room.countDocuments({ status: 'completed' });
    const scheduledRooms = await Room.countDocuments({ status: 'scheduled' });
    const roomsWithDuration = await Room.countDocuments({ duration: { $gt: 0 } });
    const roomsWithMaxParticipants = await Room.countDocuments({ maxParticipants: { $gt: 0 } });

    console.log('\n📊 Migration Summary:');
    console.log('─────────────────────────────────────');
    console.log(`Total Rooms:              ${totalRooms}`);
    console.log(`Active Rooms:             ${activeRooms}`);
    console.log(`Completed Rooms:          ${completedRooms}`);
    console.log(`Scheduled Rooms:          ${scheduledRooms}`);
    console.log(`Rooms with Duration:      ${roomsWithDuration}`);
    console.log(`Rooms with Max Participants: ${roomsWithMaxParticipants}`);
    console.log('─────────────────────────────────────\n');

    // Sample data
    console.log('📝 Sample Room Data:');
    const sampleRoom = await Room.findOne({ status: 'completed' }).populate('createdBy', 'name email');
    if (sampleRoom) {
      console.log('─────────────────────────────────────');
      console.log(`Name:             ${sampleRoom.name}`);
      console.log(`Subject:          ${sampleRoom.subject}`);
      console.log(`Status:           ${sampleRoom.status}`);
      console.log(`Duration:         ${sampleRoom.duration} minutes`);
      console.log(`Max Participants: ${sampleRoom.maxParticipants}`);
      console.log(`Created:          ${sampleRoom.createdAt}`);
      console.log(`Ended:            ${sampleRoom.endedAt || 'N/A'}`);
      console.log('─────────────────────────────────────\n');
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Restart your backend server');
    console.log('2. Test the API endpoints');
    console.log('3. Verify the frontend displays correctly\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check your MONGODB_URI in .env file');
    console.error('2. Ensure MongoDB is running');
    console.error('3. Verify network connectivity');
    console.error('4. Check database permissions\n');
    process.exit(1);
  }
}

// Run migration
migrate();
