import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Room from './models/Room.js';
import User from './models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function testConnection() {
  console.log('🧪 Testing MongoDB Connection and Data Fetching\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // Test 1: Connection
    console.log('Test 1: Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}\n`);

    // Test 2: Count documents
    console.log('Test 2: Counting documents...');
    const roomCount = await Room.countDocuments();
    const userCount = await User.countDocuments();
    console.log(`✅ Rooms: ${roomCount}`);
    console.log(`✅ Users: ${userCount}\n`);

    // Test 3: Fetch active rooms
    console.log('Test 3: Fetching active rooms...');
    const activeRooms = await Room.find({ 
      ended: false,
      status: 'active'
    }).populate('createdBy', 'name email').limit(5);
    console.log(`✅ Found ${activeRooms.length} active rooms`);
    if (activeRooms.length > 0) {
      console.log('\nSample active room:');
      console.log(`  Name: ${activeRooms[0].name}`);
      console.log(`  Subject: ${activeRooms[0].subject}`);
      console.log(`  Participants: ${activeRooms[0].participants.length}`);
      console.log(`  Created: ${activeRooms[0].createdAt}`);
    }
    console.log();

    // Test 4: Fetch completed rooms
    console.log('Test 4: Fetching completed rooms...');
    const completedRooms = await Room.find({ 
      status: 'completed'
    }).sort({ endedAt: -1 }).limit(5);
    console.log(`✅ Found ${completedRooms.length} completed rooms`);
    if (completedRooms.length > 0) {
      console.log('\nSample completed room:');
      console.log(`  Name: ${completedRooms[0].name}`);
      console.log(`  Duration: ${completedRooms[0].duration} minutes`);
      console.log(`  Max Participants: ${completedRooms[0].maxParticipants}`);
      console.log(`  Ended: ${completedRooms[0].endedAt}`);
    }
    console.log();

    // Test 5: Fetch scheduled rooms
    console.log('Test 5: Fetching scheduled rooms...');
    const scheduledRooms = await Room.find({ 
      status: 'scheduled',
      scheduledFor: { $gte: new Date() }
    }).sort({ scheduledFor: 1 }).limit(5);
    console.log(`✅ Found ${scheduledRooms.length} scheduled rooms`);
    if (scheduledRooms.length > 0) {
      console.log('\nSample scheduled room:');
      console.log(`  Name: ${scheduledRooms[0].name}`);
      console.log(`  Scheduled for: ${scheduledRooms[0].scheduledFor}`);
    }
    console.log();

    // Test 6: Status distribution
    console.log('Test 6: Analyzing room status distribution...');
    const statusDistribution = await Room.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('✅ Status distribution:');
    statusDistribution.forEach(item => {
      console.log(`  ${item._id || 'undefined'}: ${item.count}`);
    });
    console.log();

    // Test 7: Check for rooms without new fields
    console.log('Test 7: Checking data integrity...');
    const roomsWithoutDuration = await Room.countDocuments({ 
      duration: { $exists: false } 
    });
    const roomsWithoutStatus = await Room.countDocuments({ 
      status: { $exists: false } 
    });
    const roomsWithoutMaxParticipants = await Room.countDocuments({ 
      maxParticipants: { $exists: false } 
    });
    
    if (roomsWithoutDuration === 0 && roomsWithoutStatus === 0 && roomsWithoutMaxParticipants === 0) {
      console.log('✅ All rooms have required fields');
    } else {
      console.log('⚠️  Some rooms missing fields:');
      if (roomsWithoutDuration > 0) console.log(`  - ${roomsWithoutDuration} rooms without duration`);
      if (roomsWithoutStatus > 0) console.log(`  - ${roomsWithoutStatus} rooms without status`);
      if (roomsWithoutMaxParticipants > 0) console.log(`  - ${roomsWithoutMaxParticipants} rooms without maxParticipants`);
      console.log('\n💡 Run: node migrate.js to fix this');
    }
    console.log();

    // Test 8: Sample user data
    console.log('Test 8: Fetching sample user...');
    const sampleUser = await User.findOne().populate('createdRooms').populate('joinedRooms');
    if (sampleUser) {
      console.log('✅ Sample user found:');
      console.log(`  Name: ${sampleUser.name}`);
      console.log(`  Email: ${sampleUser.email}`);
      console.log(`  Created Rooms: ${sampleUser.createdRooms?.length || 0}`);
      console.log(`  Joined Rooms: ${sampleUser.joinedRooms?.length || 0}`);
      console.log(`  Total Study Hours: ${sampleUser.totalStudyHours || 0}`);
    } else {
      console.log('⚠️  No users found in database');
    }
    console.log();

    // Test 9: Calculate statistics
    console.log('Test 9: Calculating statistics...');
    const totalDuration = await Room.aggregate([
      { $match: { status: 'completed', duration: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$duration' } } }
    ]);
    const totalMinutes = totalDuration[0]?.total || 0;
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
    console.log(`✅ Total study time: ${totalHours} hours (${totalMinutes} minutes)`);
    console.log();

    // Summary
    console.log('═══════════════════════════════════════════════');
    console.log('📊 Summary:');
    console.log('═══════════════════════════════════════════════');
    console.log(`Total Rooms:       ${roomCount}`);
    console.log(`Total Users:       ${userCount}`);
    console.log(`Active Rooms:      ${activeRooms.length}`);
    console.log(`Completed Rooms:   ${completedRooms.length}`);
    console.log(`Scheduled Rooms:   ${scheduledRooms.length}`);
    console.log(`Total Study Time:  ${totalHours} hours`);
    console.log('═══════════════════════════════════════════════\n');

    console.log('✅ All tests passed! MongoDB connection is working correctly.\n');
    console.log('Next steps:');
    console.log('1. Start the backend: npm run dev');
    console.log('2. Start the frontend: npm run dev (in parent directory)');
    console.log('3. Test the API endpoints');
    console.log('4. Verify the UI displays data correctly\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check MONGO_URI in .env file');
    console.error('2. Ensure MongoDB is accessible');
    console.error('3. Verify network connectivity');
    console.error('4. Check database permissions');
    console.error('5. Run: node migrate.js if data is missing\n');
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connection closed');
    process.exit(0);
  }
}

testConnection();
