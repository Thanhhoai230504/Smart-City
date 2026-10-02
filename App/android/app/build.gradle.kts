plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "vn.danang.smartcity.smart_city_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // Khoá định danh VĨNH VIỄN trên Play Store — đã publish thì không đổi được,
        // và là khoá của Firebase app (B2) + OAuth client ID (B4). Phase 0.0b.
        applicationId = "vn.danang.smartcity.smart_city_app"
        // flutter_secure_storage (Keystore) cần API 23+.
        minSdk = maxOf(flutter.minSdkVersion, 23)
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // Task 7.2: keystore thật KHÔNG commit (đã .gitignore *.jks, key.properties);
            // tạm ký bằng debug key để `flutter run --release` chạy được khi phát triển.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
