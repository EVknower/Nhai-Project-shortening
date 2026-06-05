import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import EmployeeRepository from '../database/repositories/EmployeeRepository';
import SyncQueueRepository from '../database/repositories/SyncQueueRepository';
import {DEPARTMENTS, Department} from '../types/Employee';
import {logger} from '../utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'EmployeeRegistration'>;

const EmployeeRegistrationScreen: React.FC<Props> = ({navigation}) => {
  const [name, setName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    }
    if (!employeeCode.trim()) {
      newErrors.employeeCode = 'Employee code is required';
    } else if (!/^[A-Z0-9-_]{3,20}$/i.test(employeeCode.trim())) {
      newErrors.employeeCode = 'Code must be 3-20 alphanumeric characters';
    }
    if (!department) {
      newErrors.department = 'Please select a department';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }
    setLoading(true);
    try {
      // Check uniqueness
      const existing = await EmployeeRepository.findByEmployeeCode(
        employeeCode.trim().toUpperCase(),
      );
      if (existing) {
        setErrors(prev => ({
          ...prev,
          employeeCode: 'Employee code already exists',
        }));
        return;
      }

      const employee = await EmployeeRepository.create({
        name: name.trim(),
        employeeCode: employeeCode.trim().toUpperCase(),
        department: department as Department,
      });

      await SyncQueueRepository.enqueue(
        'EMPLOYEE',
        employee.id,
        'CREATE',
        employee,
      );

      logger.info(`Employee registered: ${employee.id}`);

      navigation.replace('FaceEnrollment', {
        employeeId: employee.id,
        employeeName: employee.name,
      });
    } catch (error) {
      logger.error('Registration failed:', error);
      Alert.alert('Error', 'Failed to register employee. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Employee Details</Text>

        <InputField
          label="Full Name"
          placeholder="e.g. Rahul Sharma"
          value={name}
          onChangeText={setName}
          error={errors.name}
          autoCapitalize="words"
        />

        <InputField
          label="Employee Code"
          placeholder="e.g. EMP001"
          value={employeeCode}
          onChangeText={text => setEmployeeCode(text.toUpperCase())}
          error={errors.employeeCode}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Department</Text>
        <View style={styles.deptGrid}>
          {DEPARTMENTS.map((dept: Department) => (
            <TouchableOpacity
              key={dept}
              style={[
                styles.deptChip,
                department === dept && styles.deptChipActive,
              ]}
              onPress={() => setDepartment(dept)}>
              <Text
                style={[
                  styles.deptChipText,
                  department === dept && styles.deptChipTextActive,
                ]}>
                {dept}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.department && (
          <Text style={styles.errorText}>{errors.department}</Text>
        )}
      </View>

      <View style={styles.nextStepInfo}>
        <Text style={styles.nextStepIcon}>📷</Text>
        <Text style={styles.nextStepText}>
          After registration, you'll capture 5 face angles for enrollment
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.85}>
        {loading ? (
          <ActivityIndicator color="#0A0E1A" />
        ) : (
          <Text style={styles.submitButtonText}>Register & Enroll Face →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const InputField: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}> = ({label, placeholder, value, onChangeText, error, autoCapitalize}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, error ? styles.inputError : undefined]}
      placeholder={placeholder}
      placeholderTextColor="#4A5568"
      value={value}
      onChangeText={onChangeText}
      autoCapitalize={autoCapitalize}
    />
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0E1A'},
  content: {padding: 20, paddingBottom: 40},
  card: {
    backgroundColor: '#1A1F2E',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  fieldContainer: {marginBottom: 16},
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8892A4',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0F1219',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputError: {
    borderColor: '#FF6B35',
  },
  errorText: {
    color: '#FF6B35',
    fontSize: 12,
    marginTop: 4,
  },
  deptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  deptChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#0F1219',
  },
  deptChipActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderColor: '#00D4FF',
  },
  deptChipText: {
    color: '#8892A4',
    fontSize: 14,
    fontWeight: '500',
  },
  deptChipTextActive: {
    color: '#00D4FF',
    fontWeight: '700',
  },
  nextStepInfo: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    gap: 12,
  },
  nextStepIcon: {fontSize: 24},
  nextStepText: {
    flex: 1,
    fontSize: 13,
    color: '#8892A4',
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#00D4FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#0A0E1A',
    fontSize: 17,
    fontWeight: '800',
  },
});

export default EmployeeRegistrationScreen;
