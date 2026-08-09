# SSBMax Custom Lint Rules

This module contains custom Android Lint rules that enforce architectural patterns, best practices, and prevent common anti-patterns in the SSBMax codebase.

## 📋 Quick Reference

| Rule ID | Severity | What It Detects | How to Fix |
|---------|----------|-----------------|------------|
| **StateFlowValueAssignment** | ERROR | `.value = .value.copy()` pattern | Use `.update { it.copy(...) }` |
| **SingletonMutableState** | ERROR | Mutable state in singleton objects | Use ViewModel or Repository |
| **NullableViewModelState** | ERROR | Nullable mutable vars in ViewModels | Move to StateFlow in UiState |
| **ViewModelJobLeak** | ERROR | Storing Job references in ViewModels | Use `viewModelScope.launch` directly |
| **PrintStackTraceUsage** | ERROR | `e.printStackTrace()` calls | Use `ErrorLogger.log(e, "description")` |
| **FirebaseInUILayer** | ERROR | Firebase imports in UI layer | Use domain abstractions (UseCases/Repos) |
| **NavigationComplexObject** | WARNING | Passing complex objects in navigation | Pass IDs, fetch data in ViewModel |
| **ViewModelLifecycleCleanup** | ERROR | Resources not cancelled in `onCleared()` | Override `onCleared()` and cleanup |
| **ComposeHardcodedText** | ERROR | Hardcoded strings in Text composables | Use `stringResource(R.string.xxx)` |

Shared KMP UI is additionally enforced by `:detekt-rules` because Android Lint does not analyze `commonMain`:

| Rule ID | Severity | What It Detects | How to Fix |
|---------|----------|-----------------|------------|
| **HardcodedComposeColor** | ERROR | Raw hex/RGB colors in shared UI | Use `MaterialTheme.colorScheme` or an approved semantic token |
| **IconOnlyControlLabel** | ERROR | IconButton content without a detectable label | Add a localized `contentDescription` to the Icon |
| **MissingComposePreview** | WARNING | Public reusable shared components without previews | Add a private `@Preview` |

## 🚀 Running Lint Checks

```bash
# Run all lint checks (includes custom rules)
./gradlew lintDebug

# Run lint on specific module
./gradlew :app:lintDebug

# Generate HTML lint report
./gradlew lintDebug
# Report location: app/build/reports/lint-results-debug.html
```

## 🔍 Example Violations & Fixes

### 1. StateFlowValueAssignment

**❌ Wrong - Race Condition Risk:**
```kotlin
private val _uiState = MutableStateFlow(UiState())

fun updateData() {
    _uiState.value = _uiState.value.copy(isLoading = true)  // ERROR
}
```

**✅ Correct - Thread-Safe:**
```kotlin
private val _uiState = MutableStateFlow(UiState())

fun updateData() {
    _uiState.update { it.copy(isLoading = true) }  // CORRECT
}
```

### 2. SingletonMutableState

**❌ Wrong - Memory Leak:**
```kotlin
object UserHolder {
    private var currentUser: User? = null  // ERROR
}
```

**✅ Correct - Use Repository:**
```kotlin
@Singleton
class UserRepository @Inject constructor() {
    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()
}
```

### 3. NullableViewModelState

**❌ Wrong - Not Configuration-Safe:**
```kotlin
class MyViewModel : ViewModel() {
    private var sessionId: String? = null  // ERROR
}
```

**✅ Correct - Survives Config Changes:**
```kotlin
class MyViewModel : ViewModel() {
    data class UiState(val sessionId: String? = null)
    private val _uiState = MutableStateFlow(UiState())
    val uiState = _uiState.asStateFlow()
}
```

### 4. ViewModelJobLeak

**❌ Wrong - Memory Leak Risk:**
```kotlin
class TimerViewModel : ViewModel() {
    private var timerJob: Job? = null  // ERROR
    
    fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch { /* ... */ }
    }
}
```

**✅ Correct - Auto-Cancelled:**
```kotlin
class TimerViewModel : ViewModel() {
    fun startTimer() {
        viewModelScope.launch {
            // Automatically cancelled when ViewModel cleared
        }
    }
}
```

### 5. PrintStackTraceUsage

**❌ Wrong - Not Logged to Crashlytics:**
```kotlin
try {
    riskyOperation()
} catch (e: Exception) {
    e.printStackTrace()  // ERROR
}
```

**✅ Correct - Integrated Logging:**
```kotlin
try {
    riskyOperation()
} catch (e: Exception) {
    ErrorLogger.log(e, "Failed to perform risky operation")
}
```

### 6. FirebaseInUILayer

**❌ Wrong - Violates Clean Architecture:**
```kotlin
@HiltViewModel
class MyViewModel @Inject constructor(
    private val firebaseAuth: FirebaseAuth  // ERROR
) : ViewModel()
```

**✅ Correct - Domain Abstraction:**
```kotlin
@HiltViewModel
class MyViewModel @Inject constructor(
    private val observeCurrentUser: ObserveCurrentUserUseCase  // CORRECT
) : ViewModel()
```

### 7. ComposeHardcodedText

**❌ Wrong - Not Internationalized:**
```kotlin
Text("Submit Test")  // ERROR
```

**✅ Correct - String Resource:**
```kotlin
Text(stringResource(R.string.submit_test))  // CORRECT
```

## ⚙️ Configuring Lint Rules

To disable a rule for specific files, edit `app/lint.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<lint>
    <!-- Ignore hardcoded text in test files -->
    <issue id="ComposeHardcodedText" severity="error">
        <ignore path="**/test/**" />
        <ignore path="**/androidTest/**" />
    </issue>
    
    <!-- Suppress specific violation in a file -->
    <issue id="SingletonMutableState" severity="ignore">
        <ignore path="**/SpecificFile.kt" />
    </issue>
</lint>
```

**⚠️ Use sparingly!** Suppressions should be rare exceptions, not the norm.

## Enforcement exceptions

The only built-in color exception is `shared.ui.theme`, where centralized token definitions are declared. Content-provided gradients may parse their input into `Color` values, but feature screens must not add raw literals. If a genuine external brand requirement cannot use a semantic role, use a narrowly scoped Detekt suppression with both a justification and removal condition:

```kotlin
@Suppress("HardcodedComposeColor") // Justification: approved external brand asset; removal: when brand token is available.
```

Icon-only actions never use `contentDescription = null`; decorative icons outside an action remain silent. Do not suppress `IconOnlyControlLabel` for an interactive control.

## 🧪 Testing Custom Lint Rules

```bash
# Run lint rule unit tests
./gradle.sh :lint:test

# Run specific lint test
./gradle.sh :lint:test --tests "*StateFlowValueAssignmentDetectorTest"
```

## 📚 Architecture Context

These lint rules enforce the SSBMax architectural principles:

- **MVVM Pattern**: ViewModels manage UI state via StateFlow
- **Clean Architecture**: UI layer uses domain abstractions, not infrastructure (Firebase)
- **ID-Based Navigation**: Pass IDs, not complex objects, between screens
- **Thread Safety**: Atomic StateFlow updates prevent race conditions
- **Memory Safety**: Proper lifecycle management prevents leaks
- **Error Handling**: Centralized logging with crash reporting integration

## 🔗 Related Files

- **Issue Registry**: `lint/src/main/kotlin/com/ssbmax/lint/SSBMaxIssueRegistry.kt`
- **Detector Implementations**: `lint/src/main/kotlin/com/ssbmax/lint/*Detector.kt`
- **Integration Tests**: `lint/src/test/kotlin/com/ssbmax/lint/*IntegrationTest.kt`
- **CI Configuration**: `.github/workflows/ci.yml` (runs lint on every PR)
- **Architecture Tests**: `app/src/test/kotlin/com/ssbmax/testing/ArchitectureTest.kt`

## 📝 Adding New Lint Rules

1. Create detector class extending `Detector` and implementing `SourceCodeScanner`
2. Define issue with ID, severity, explanation, and implementation
3. Register issue in `SSBMaxIssueRegistry.kt`
4. Add integration tests in `lint/src/test/kotlin/`
5. Update this README with the new rule

## 🆘 Need Help?

- **Build Fails with Lint Error**: Read error message carefully - it includes fix instructions
- **False Positive**: Consider if the pattern is truly safe, or suppress in `lint.xml` if necessary
- **Rule Not Triggering**: Run `./gradle.sh clean` then `./gradle.sh lintDebug`
- **Questions**: See detector implementation file for detailed explanations

---

**Remember**: These lint rules exist to prevent bugs, memory leaks, and architectural violations. If you encounter a rule error, it's usually catching a real issue - fix the code, not the rule! 🛡️



