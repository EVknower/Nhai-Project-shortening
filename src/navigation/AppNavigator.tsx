import React from 'react';
import {Text, View, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {RootStackParamList, MainTabParamList} from './types';

// Screens
import SplashScreen from '../screens/SplashScreen';
import HomeScreen from '../screens/HomeScreen';
import EmployeeRegistrationScreen from '../screens/EmployeeRegistrationScreen';
import FaceEnrollmentScreen from '../screens/FaceEnrollmentScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import LivenessChallengeScreen from '../screens/LivenessChallengeScreen';
import OfflineRecordsScreen from '../screens/OfflineRecordsScreen';
import SyncStatusScreen from '../screens/SyncStatusScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TEAL = '#00D4FF';
const BG_DARK = '#0A0E1A';
const SURFACE = '#1A1F2E';
const TEXT_MUTED = '#4A5568';

// Tab bar icon helper
function TabIcon({
  emoji,
  focused,
}: {
  emoji: string;
  focused: boolean;
}) {
  return (
    <View style={[tabStyles.iconWrapper, focused && tabStyles.iconWrapperActive]}>
      <Text style={tabStyles.emoji}>{emoji}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrapper: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
  },
  emoji: {fontSize: 18},
});

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: SURFACE,
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: TEAL,
        tabBarInactiveTintColor: TEXT_MUTED,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="🏠" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Records"
        component={OfflineRecordsScreen}
        options={{
          tabBarLabel: 'Records',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="📋" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="SyncStatus"
        component={SyncStatusScreen}
        options={{
          tabBarLabel: 'Sync',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="☁️" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="⚙️" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: {backgroundColor: SURFACE},
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {fontWeight: '700', fontSize: 17},
          headerShadowVisible: false,
          contentStyle: {backgroundColor: BG_DARK},
          animation: 'slide_from_right',
        }}>
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{
            headerShown: true,
            title: 'FaceGuard Offline',
            headerLeft: () => null, // No back from main
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="EmployeeRegistration"
          component={EmployeeRegistrationScreen}
          options={{title: 'New Employee'}}
        />
        <Stack.Screen
          name="FaceEnrollment"
          component={FaceEnrollmentScreen}
          options={{
            title: 'Face Enrollment',
            gestureEnabled: false, // No swipe-back during capture
          }}
        />
        <Stack.Screen
          name="Attendance"
          component={AttendanceScreen}
          options={{title: 'Mark Attendance'}}
        />
        <Stack.Screen
          name="LivenessChallenge"
          component={LivenessChallengeScreen}
          options={{
            title: 'Liveness Check',
            gestureEnabled: false, // No back during challenge
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
