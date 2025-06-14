import {NavigationProp, useNavigation} from '@react-navigation/native';
import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import {AppColor} from '../../const/app-color';
import {AppImages} from '../../const/app-images';
import {AppFontSize} from '../../const/app-font-size';
import {AppScreen} from '../../const/app-screen';
import {ScanType} from '../../types/result';
import RadioGroup, {RadioButtonProps} from 'react-native-radio-buttons-group';

const InputScreen = () => {
  const [startValue, setStartValue] = useState('');
  const [endValue, setEndValue] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>('1');

  const handleScan = () => {
    const scanType = values.find(value => value.id === selectedId)?.value;
    navigation.navigate(
      AppScreen.ScannerScreen as never,
      {
        startValue: startValue,
        endValue: endValue,
        scanType: scanType ?? ScanType.Polyboard,
      } as never,
    );
  };

  const values: RadioButtonProps[] = useMemo(
    () => [
      {
        id: '1',
        label: ScanType.Polyboard,
        value: ScanType.Polyboard,
      },
      {
        id: '2',
        label: ScanType.Abf,
        value: ScanType.Abf,
      },
    ],
    [],
  );

  const navigation = useNavigation<any>();
  return (
    <TouchableWithoutFeedback
      style={{flex: 1}}
      onPress={() => Keyboard.dismiss()}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{flex: 1}}
        // keyboardVerticalOffset={30}
        enabled>
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Image
              style={{
                width: 60,
                height: undefined,
                aspectRatio: 1,
                marginBottom: 10,
              }}
              resizeMode="contain"
              source={AppImages.logo}
            />
            <Text style={styles.title}>NHẬP DỮ LIỆU ĐẦU VÀO</Text>

            <View style={styles.inputContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Giá trị đầu</Text>
                <TextInput
                  style={styles.input}
                  value={startValue}
                  onChangeText={setStartValue}
                  placeholderTextColor={AppColor.gray}
                  keyboardType="numeric"
                  placeholder="Nhập giá trị"
                  maxLength={7}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Giá trị cuối</Text>
                <TextInput
                  style={styles.input}
                  value={endValue}
                  onChangeText={setEndValue}
                  placeholderTextColor={AppColor.gray}
                  keyboardType="numeric"
                  placeholder="Nhập giá trị"
                  maxLength={7}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mẫu tem</Text>
                <RadioGroup
                  radioButtons={values}
                  onPress={setSelectedId}
                  selectedId={selectedId}
                  containerStyle={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignContent: 'center',
                    alignItems: 'center',
                  }}
                  labelStyle={[
                    styles.label,
                    {
                      marginBottom: 0,
                    },
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity
              disabled={!startValue || !endValue}
              style={[
                styles.scanButton,
                {
                  backgroundColor:
                    !!startValue && !!endValue ? AppColor.white : AppColor.gray,
                },
              ]}
              onPress={handleScan}>
              <Text style={styles.scanButtonText}>Quét ngay</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColor.primary,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
  },
  time: {
    fontSize: 18,
    color: '#333',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: AppFontSize.s16,
    fontWeight: 'bold',
    color: AppColor.white,
    marginTop: 10,
    marginBottom: 10,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: AppFontSize.s16,
    marginBottom: 8,
    color: AppColor.black,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: AppColor.gray,
    backgroundColor: AppColor.white,
    borderRadius: 8,
    padding: 12,
    fontSize: AppFontSize.s16,
    color: AppColor.black,
  },
  scanButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  scanButtonText: {
    color: AppColor.black,
    fontSize: AppFontSize.s18,
    fontWeight: 'bold',
  },
});

export default InputScreen;
