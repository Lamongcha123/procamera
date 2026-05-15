import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions, CameraType, FlashMode } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  PanResponder,
  StatusBar,
  Linking,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const ZOOM_PRESETS = [1, 2, 5, 10, 30, 60, 120];

function zoomToDisplay(zoom: number): number {
  return Math.round(1 + zoom * 119);
}

function displayToZoom(display: number): number {
  return Math.max(0, Math.min(1, (display - 1) / 119));
}

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [zoom, setZoom] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [gridVisible, setGridVisible] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const captureScale = useSharedValue(1);
  const captureRing = useSharedValue(0);
  const zoomIndicatorOpacity = useSharedValue(0);

  const displayZoom = zoomToDisplay(zoom);

  useEffect(() => {
    AsyncStorage.getItem("photos").then((stored) => {
      if (stored) {
        const photos = JSON.parse(stored);
        if (photos.length > 0) setLastPhoto(photos[0].uri);
      }
    });
  }, []);

  const showZoomIndicator = useCallback(() => {
    zoomIndicatorOpacity.value = withTiming(1, { duration: 150 });
    setTimeout(() => {
      zoomIndicatorOpacity.value = withTiming(0, { duration: 800 });
    }, 1200);
  }, [zoomIndicatorOpacity]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8,
    onPanResponderMove: (_, gs) => {
      const delta = -gs.dy / (SCREEN_HEIGHT * 0.5);
      setZoom((prev) => {
        const next = Math.max(0, Math.min(1, prev + delta));
        showZoomIndicator();
        return next;
      });
    },
  });

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    captureScale.value = withSpring(0.88, { damping: 15 }, () => {
      captureScale.value = withSpring(1, { damping: 12 });
    });
    captureRing.value = withTiming(1, { duration: 100 }, () => {
      captureRing.value = withTiming(0, { duration: 300 });
    });

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: true,
      });
      if (photo) {
        setLastPhoto(photo.uri);
        const stored = await AsyncStorage.getItem("photos");
        const photos = stored ? JSON.parse(stored) : [];
        photos.unshift({ uri: photo.uri, timestamp: Date.now() });
        await AsyncStorage.setItem("photos", JSON.stringify(photos.slice(0, 200)));
      }
    } catch (e) {
      console.error("Capture error:", e);
    }
    setIsCapturing(false);
  };

  const handleFlashToggle = () => {
    setFlash((f) => {
      if (f === "off") return "on";
      if (f === "on") return "auto";
      return "off";
    });
    Haptics.selectionAsync();
  };

  const handleFlipCamera = () => {
    setFacing((f) => (f === "back" ? "front" : "back"));
    Haptics.selectionAsync();
  };

  const captureButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: captureScale.value }],
  }));

  const captureRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(captureRing.value, [0, 1], [0, 0.5], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(captureRing.value, [0, 1], [1, 1.4], Extrapolation.CLAMP) },
    ],
  }));

  const zoomIndicatorStyle = useAnimatedStyle(() => ({
    opacity: zoomIndicatorOpacity.value,
  }));

  const flashIcon =
    flash === "off" ? "flash-off" : flash === "on" ? "flash" : "flash-outline";
  const flashColor = flash === "on" ? "#FFD700" : "#FFF";

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permContainer, { paddingTop: insets.top + 40 }]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={["#080810", "#0f0f20"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.permIconBg}>
          <Ionicons name="camera" size={52} color="#00D4FF" />
        </View>
        <Text style={styles.permTitle}>Camera Access</Text>
        <Text style={styles.permText}>
          ProCamera needs permission to access your camera and capture stunning
          120x zoom photos.
        </Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Allow Camera</Text>
        </TouchableOpacity>
        {!permission.canAskAgain && Platform.OS !== "web" && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              try {
                Linking.openSettings();
              } catch {}
            }}
          >
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" hidden />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        zoom={zoom}
        {...(Platform.OS !== "web" ? panResponder.panHandlers : {})}
      >
        {/* Grid overlay */}
        {gridVisible && (
          <View style={styles.gridOverlay} pointerEvents="none">
            <View style={styles.gridRow}>
              <View style={styles.gridLine} />
              <View style={styles.gridLine} />
            </View>
            <View style={styles.gridCol}>
              <View style={styles.gridLineV} />
              <View style={styles.gridLineV} />
            </View>
          </View>
        )}
      </CameraView>

      {/* Top gradient */}
      <LinearGradient
        colors={["rgba(0,0,0,0.7)", "transparent"]}
        style={[styles.topGradient, { height: insets.top + 80 }]}
        pointerEvents="none"
      />

      {/* Bottom gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Zoom indicator badge */}
      <Animated.View style={[styles.zoomBadge, zoomIndicatorStyle]}>
        <Text style={styles.zoomBadgeText}>{displayZoom}×</Text>
      </Animated.View>

      {/* Top controls */}
      <View style={[styles.topControls, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.push("/gallery")}
          style={styles.iconBtn}
        >
          <Ionicons name="images-outline" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.zoomLabel}>
          <Text style={styles.zoomLabelText}>{displayZoom}×</Text>
        </View>

        <View style={styles.topRight}>
          <TouchableOpacity onPress={() => setGridVisible((v) => !v)} style={styles.iconBtn}>
            <MaterialCommunityIcons
              name="grid"
              size={20}
              color={gridVisible ? "#00D4FF" : "#FFF"}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleFlashToggle} style={styles.iconBtn}>
            <Ionicons name={flashIcon} size={22} color={flashColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleFlipCamera} style={styles.iconBtn}>
            <Ionicons name="camera-reverse-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Zoom preset bar */}
      <View style={styles.zoomBar}>
        {ZOOM_PRESETS.map((z) => {
          const isActive = displayZoom === z;
          return (
            <TouchableOpacity
              key={z}
              onPress={() => {
                setZoom(displayToZoom(z));
                Haptics.selectionAsync();
                showZoomIndicator();
              }}
              style={[styles.zoomPreset, isActive && styles.zoomPresetActive]}
            >
              <Text
                style={[
                  styles.zoomPresetText,
                  isActive && styles.zoomPresetTextActive,
                ]}
              >
                {z}×
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Zoom slider indicator */}
      <View style={styles.zoomHint}>
        <Feather name="chevrons-up" size={14} color="rgba(255,255,255,0.4)" />
        <Text style={styles.zoomHintText}>Swipe up/down to zoom</Text>
        <Feather name="chevrons-down" size={14} color="rgba(255,255,255,0.4)" />
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 24 }]}>
        {/* Last photo thumbnail */}
        {lastPhoto ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/edit", params: { uri: lastPhoto } })}
            style={styles.thumbnail}
          >
            <Image
              source={{ uri: lastPhoto }}
              style={styles.thumbnailImg}
              contentFit="cover"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.thumbnailEmpty}>
            <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.3)" />
          </View>
        )}

        {/* Capture button */}
        <View style={styles.captureWrapper}>
          <Animated.View style={[styles.captureRing, captureRingStyle]} />
          <Animated.View style={captureButtonStyle}>
            <TouchableOpacity
              onPress={handleCapture}
              disabled={isCapturing}
              style={styles.captureOuter}
              activeOpacity={0.9}
            >
              <View style={[styles.captureInner, isCapturing && { opacity: 0.6 }]} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Settings / mode placeholder */}
        <TouchableOpacity
          onPress={() => router.push("/gallery")}
          style={styles.thumbnailEmpty}
        >
          <Ionicons name="grid-outline" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
    gap: 18,
    backgroundColor: "#080810",
  },
  permIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(0,212,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  permTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  permText: {
    color: "#7777AA",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
  permButton: {
    backgroundColor: "#00D4FF",
    paddingHorizontal: 44,
    paddingVertical: 15,
    borderRadius: 30,
    marginTop: 8,
  },
  permButtonText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  settingsButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  settingsButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  topGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },
  zoomBadge: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.4)",
  },
  zoomBadgeText: {
    color: "#00D4FF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  topControls: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  zoomLabel: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 18,
  },
  zoomLabelText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  topRight: {
    flexDirection: "row",
    gap: 6,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBar: {
    position: "absolute",
    bottom: 160,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  zoomPreset: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  zoomPresetActive: {
    backgroundColor: "#00D4FF",
    borderColor: "#00D4FF",
  },
  zoomPresetText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  zoomPresetTextActive: {
    color: "#000",
  },
  zoomHint: {
    position: "absolute",
    bottom: 148,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  zoomHintText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  thumbnail: {
    width: 58,
    height: 58,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
  },
  thumbnailEmpty: {
    width: 58,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureWrapper: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  captureRing: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "#FFF",
  },
  captureOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3.5,
    borderColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFF",
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "column",
    justifyContent: "space-evenly",
  },
  gridLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 0,
  },
  gridCol: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
  gridLineV: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
