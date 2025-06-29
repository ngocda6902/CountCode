import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  LayoutChangeEvent,
  LayoutRectangle,
  TouchableOpacity,
} from 'react-native';
import {
  Camera,
  CameraRuntimeError,
  Frame,
  runAtTargetFps,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import Reanimated, {AnimatedStyle} from 'react-native-reanimated';
import {
  NavigationProp,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import {useIsForeground} from '../../hooks/use-is-foreground';
import {useCallback, useEffect, useRef, useState} from 'react';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../../const/app-const';
import {useTextRecognition} from 'react-native-vision-camera-text-recognition';
import {TextRecognitionOptions} from 'react-native-vision-camera-text-recognition/lib/typescript/src/types';
import {useRunOnJS, useSharedValue} from 'react-native-worklets-core';
import {BlocksData, Result, ScanType} from '../../types/result';
import {
  ABF_SCAN_REGEX,
  appUtils,
  AppUtils,
  POLYBOARD_SCAN_REGEX,
} from '../../utils';
import {AppScreen} from '../../const/app-screen';
import {FrameBlock} from '../../types/item';
import {AppFontSize} from '../../const/app-font-size';
import {ReanimatedCamera} from '../reanimated-camera';
import {useToast} from '../../hooks/use-toast';
import {appLogger} from '../../logger/app-logger';

export const TextRecognitionCamera = ({
  containerStyle,
  startValue,
  endValue,
  scanType,
}: {
  containerStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  startValue: string;
  endValue: string;
  scanType: ScanType;
}) => {
  const {hasPermission} = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  // shared value use between ui thread and native thread
  const scannedValueShared = useSharedValue<string[]>([]);

  const scanBoxLayout = useSharedValue<LayoutRectangle | null>(null);
  const cameraLayout = useSharedValue<LayoutRectangle | null>(null);
  const isHandlingData = useSharedValue(false);
  const scanningType = useSharedValue(scanType);
  const cameraFrame = useSharedValue<FrameBlock | null>(null);
  const [isShow, setIsShow] = useState(false);
  const device = useCameraDevice('back', {});
  const isFocussed = useIsFocused();
  const isForeground = useIsForeground();
  const toast = useToast();
  const isActive = isFocussed && isForeground;
  const navigation = useNavigation<NavigationProp<any>>();
  const screenAspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;

  const options: TextRecognitionOptions = {language: 'latin'};
  const {scanText} = useTextRecognition(options);
  const format = useCameraFormat(device, [
    {fps: 60},
    {videoResolution: 'max'},
    {photoResolution: 'max'},
  ]);
  const fps = Math.min(format?.maxFps ?? 1, 60);

  const onError = useCallback((error: CameraRuntimeError) => {
    console.error(error);
  }, []);

  /**
   * Checks if a given string value, when parsed as an integer, falls within the inclusive range
   * defined by `startValue` and `endValue`.
   *
   * @param val - The string representation of the number to validate.
   * @returns `true` if the parsed number is within the range `[startValue, endValue]`, otherwise `false`.
   *
   * @remarks
   * - Assumes `startValue` and `endValue` are valid string representations of integers.
   * - If `val` cannot be parsed to a number, the result may be `false` or `NaN` comparison.
   */
  const isValidInRange = useCallback(
    (val: string) => {
      const num = parseInt(val, 10);
      const start = parseInt(startValue, 10);
      const end = parseInt(endValue, 10);
      return num >= start && num <= end;
    },
    [startValue, endValue],
  );

  /**
   * Handles the result of text recognition.
   * It will check if the blocks match the regex of Polyboard, filter out the blocks that are not in the scan box,
   * and add new values to the list of scanned values, or mark as duplicate if the value already exists in the list.
   * The UI will be updated accordingly.
   *
   * @param result - The result of text recognition, containing the list of blocks.
   * @returns A promise that resolves when the handling is done.
   *
   * @remarks
   * - The function will not do anything if the result is empty.
   * - The function will not do anything if the result contains no blocks that match the regex of Polyboard.
   * - The function will not do anything if the result contains no blocks that are in the scan box.
   * - The function will not do anything if the result contains no new values that are not in the list of scanned values.
   * - The function will update the UI by showing a toast for each new value, and update the list of scanned values.
   * - The function will wait for 1 second between each toast to avoid spamming the user.
   */
  const handleScanPolyBoardResult = async (result: Result) => {
    appLogger.log('result', result);
    if (!result?.blocks?.length) return;

    isHandlingData.value = true;

    let matchedBlocks = result.blocks.filter(block =>
      POLYBOARD_SCAN_REGEX.test(block.blockText),
    );

    matchedBlocks = matchedBlocks.filter(block =>
      appUtils.isBlockInScanBox(
        block,
        scanBoxLayout.value!,
        cameraLayout.value!,
        cameraFrame.value!,
      ),
    );

    if (!matchedBlocks.length) {
      isHandlingData.value = false;
      return;
    }

    const newValues = new Set<string>();
    const scannedValues = scannedValueShared.value;

    matchedBlocks.forEach(matchedBlock => {
      if (!matchedBlock?.blockText) return;

      const rawValue = matchedBlock.blockText
        .trim()
        .replaceAll('*', '')
        .slice(1);
      if (!rawValue) return;

      if (!isValidInRange(rawValue)) return;

      const isDontExist =
        !newValues.has(rawValue) && !scannedValues.includes(rawValue);

      if (isDontExist) {
        newValues.add(rawValue);
      }

      if (scannedValues.includes(rawValue)) {
        newValues.add(`duplicate:${rawValue}`);
      }
    });

    for (const value of newValues) {
      const isDuplicate =
        typeof value === 'string' && value.startsWith('duplicate:');
      const raw = isDuplicate ? value.replace('duplicate:', '') : value;
      if (isDuplicate) {
        toast.showInfo(`${raw} đã được quét trước đó`);
      } else {
        toast.showSuccess(`Đã quét: ${raw}`);
      }

      await AppUtils.delay(1000);
    }

    scannedValueShared.value = [
      ...scannedValues,
      ...Array.from(newValues).filter(v => !`${v}`.startsWith('duplicate:')),
    ];

    isHandlingData.value = false;
  };

  const handleScanAbf = async (result: Result) => {
    console.log('abf result', result);

    if (!result?.blocks?.length) return;

    isHandlingData.value = true;

    const scannedValues = scannedValueShared.value;

    const matchSet = new Set<BlocksData>(
      result.blocks.filter(block => {
        const rawValue = block.blockText.trim();
        return (
          ABF_SCAN_REGEX.test(rawValue) &&
          isValidInRange(rawValue) &&
          appUtils.isBlockInScanBox(
            block,
            scanBoxLayout.value!,
            cameraLayout.value!,
            cameraFrame.value!,
          )
        );
      }),
    );

    const matchedBlocks = Array.from(matchSet);

    if (!matchedBlocks.length || matchedBlocks.length <= 1) {
      isHandlingData.value = false;
      return;
    }

    const sortedBlocks = [
      appUtils
        .getSortedBlocksInScanBox(
          matchedBlocks,
          scanBoxLayout.value!,
          cameraLayout.value!,
          cameraFrame.value!,
        )
        .at(0),
    ];
    const uniqueValues = [
      ...new Set(sortedBlocks.map(b => b!.blockText.trim())),
    ];

    await processAlertsSequentially(uniqueValues);
  };

  const processAlertsSequentially = async (values: string[]) => {
    for (const value of values) {
      const isDuplicate = scannedValueShared.value.includes(value);
      if (isDuplicate) {
        toast.showInfo(`${value} đã được quét trước đó`);
      } else {
        toast.showSuccess(`Đã quét: ${value}`);
        scannedValueShared.value = [...scannedValueShared.value, value];
      }

      await AppUtils.delay(1000);
    }

    isHandlingData.value = false;
  };

  /**
   * A callback hook that runs the provided JavaScript handler (`handleScanPolyBoardResult`)
   * when the `useRunOnJS` event is triggered with a `Result` object.
   *
   * @remarks
   * This hook is memoized and will update whenever any of the dependencies
   * (`options`, `scanBoxLayout`, `cameraFrame`, `isHandlingData`) change.
   *
   * @returns A function that can be used to handle scan results on the JavaScript thread.
   *
   * @see {@link useRunOnJS}
   *
   * @param data - The scan result of type `Result` to be handled.
   */
  const useHandleDataOnJS = useRunOnJS(
    (data: Result): void => {
      if (
        cameraFrame?.value?.height &&
        cameraFrame?.value?.height < appUtils.logicalHeight
      ) {
        return;
      }
      if (scanningType.value === ScanType.Polyboard) {
        handleScanPolyBoardResult(data);
      } else {
        handleScanAbf(data);
      }
    },
    [options, scanBoxLayout, cameraFrame, isHandlingData, scanningType],
  );

  /**
   * A custom hook that creates a callback to handle camera frame updates on the JS thread.
   *
   * This hook uses `useRunOnJS` to ensure the provided callback is executed on the JavaScript thread
   * whenever a new camera frame is received. The callback updates the `cameraFrame` reference with
   * the latest frame's width and height, casting the result to a `FrameBlock`.
   *
   * @param frame - The camera frame object containing width and height properties.
   * @returns A memoized callback function to handle frame updates.
   *
   * @example
   * const handleFrame = useHandleFrameOnJS;
   * // Use `handleFrame` as a callback for camera frame events.
   */
  const useHandleFrameOnJS = useRunOnJS(
    (frame: Frame): void => {
      cameraFrame.value = {
        width: frame.width,
        height: frame.height,
      } as FrameBlock;
    },
    [cameraFrame],
  );

  /**
   * Frame processor callback for handling camera frames in a React Native Vision Camera component.
   *
   * This processor runs at a target frame rate of 1 FPS. It checks if data is currently being handled
   * (using the `isHandlingData` shared value). If not, it processes the incoming frame by:
   * - Calling `useHandleFrameOnJS` with the current frame.
   * - Scanning the frame for text using `scanText`.
   * - Passing the scanned data to `useHandleDataOnJS`.
   *
   * @param frame - The camera frame to process.
   * @returns void
   *
   * @remarks
   * - This function is intended to be used with the `useFrameProcessor` hook from Vision Camera.
   * - The function body is executed as a worklet on the UI thread.
   * - The dependencies array is empty, so the processor is only created once.
   */
  const frameProcessor = useFrameProcessor(frame => {
    'worklet';

    runAtTargetFps(1, () => {
      'worklet';
      if (isHandlingData.value) {
        return;
      }
      useHandleFrameOnJS(frame);
      const data = scanText(frame) as any;
      useHandleDataOnJS(data);
    });
  }, []);

  const handleEndScan = () => {
    navigation.navigate(AppScreen.ResultScreen, {
      scannedData: scannedValueShared.value,
      startValue,
      endValue,
    });
  };

  const onScanBoxLayout = (event: LayoutChangeEvent) => {
    console.log('onScanBoxLayout', event.nativeEvent.layout);
    scanBoxLayout.value = event.nativeEvent.layout;
  };

  const onCameraLayout = (event: LayoutChangeEvent) => {
    cameraLayout.value = event.nativeEvent.layout;
  };

  useEffect(() => {
    if (!!scanType && scanType !== scanningType.value) {
      scanningType.value = scanType;
    }
  }, [scanType]);

  if (!device || !hasPermission) {
    return (
      <View style={styles.loading}>
        <Text>Đang tải camera...</Text>
      </View>
    );
  }

  return (
    <>
      <Reanimated.View onTouchEnd={() => {}} style={[containerStyle]}>
        <ReanimatedCamera
          onLayout={onCameraLayout}
          style={StyleSheet.absoluteFill}
          ref={cameraRef}
          device={device}
          isActive={isActive}
          onError={onError}
          format={format}
          fps={fps}
          photoQualityBalance="speed"
          enableZoomGesture={true}
          exposure={0}
          enableFpsGraph={true}
          outputOrientation="device"
          photo={true}
          video={true}
          zoom={30}
          frameProcessor={frameProcessor}
          resizeMode={'cover'}
          pixelFormat="yuv"
        />
        {scanType == ScanType.Polyboard && (
          <View onLayout={onScanBoxLayout} style={[styles.scanBox]} />
        )}

        {scanType == ScanType.Abf && (
          <View onLayout={onScanBoxLayout} style={[styles.abfScanBox]} />
        )}
      </Reanimated.View>
      <TouchableOpacity style={styles.endScanButton} onPress={handleEndScan}>
        <Text style={styles.endScanText}>Kết thúc quét</Text>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.3,
    left: SCREEN_WIDTH * 0.1,
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_HEIGHT * 0.2,
    borderColor: 'red',
    borderWidth: 2,
    borderRadius: 8,
    zIndex: 100,
  },
  abfScanBox: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.3,
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_HEIGHT * 0.2,
    borderColor: 'red',
    borderWidth: 2,
    borderRadius: 8,
    zIndex: 100,
    alignSelf: 'center',
  },
  endScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 32,
    alignSelf: 'center',
    position: 'absolute',
    bottom: 20,
  },
  endScanText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: AppFontSize.s16,
  },
});
