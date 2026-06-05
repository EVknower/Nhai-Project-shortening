import {NavigatorScreenParams} from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  EmployeeRegistration: undefined;
  FaceEnrollment: {employeeId: string; employeeName: string};
  Attendance: undefined;
  LivenessChallenge: {
    employeeId: string;
    employeeName: string;
    matchScore: number;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Records: undefined;
  SyncStatus: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
