package com.ssbmax.shared.data.repository

import dev.gitlive.firebase.internal.FirebaseDecoder
import dev.gitlive.firebase.internal.FirebaseEncoder
import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/**
 * Decodes/encodes a whole Firestore document as a raw `Map<String, Any>`, resolving the blocker
 * documented in [GitLiveCommonSubmissionRepository]'s class doc.
 *
 * ## Why this works despite GitLive Firestore 2.1.0 having no public raw-Map decode/encode path
 * `DocumentSnapshot.data<reified T>()`/`data(strategy)` and `DocumentReference.set(strategy, data)`
 * both resolve a [kotlinx.serialization.DeserializationStrategy]/[kotlinx.serialization.SerializationStrategy]
 * at compile time — there's no `Map<String, Any>` overload. But the [DeserializationStrategy]/
 * [SerializationStrategy] itself doesn't have to be a `@Serializable`-generated one: `data(strategy)`
 * (public, see `firestore.kt` line ~665) and `set(strategy, data)` (public, `firestore.kt` line ~410)
 * both accept *any* implementation. GitLive's own decode/encode plumbing
 * (`dev.gitlive.firebase.internal.decoders.kt`/`encoders.kt`, in the `firebase-common-internal`
 * module, a public — not `@PublishedApi internal` — API transitively on `shared`'s classpath via the
 * `firebase-common`/`firebase-firestore` dependencies) calls `deserializer.deserialize(FirebaseDecoder)`
 * / `serializer.serialize(FirebaseEncoder, value)` directly when the strategy isn't a polymorphic one
 * (verified in `Polymorphic.kt`'s `decodeSerializableValuePolymorphic`/`encodePolymorphically`).
 * Both `FirebaseDecoder.value` and `FirebaseEncoder.value` are public vars holding the raw
 * platform-native decoded/to-be-encoded structure — on Android, `encodedData()` literally delegates
 * to `DocumentSnapshot.getData(): Map<String, Any>` (verified in the android
 * `NativeDocumentSnapshotWrapper.kt`), the same call the pre-KMP Android original used directly.
 *
 * This serializer reads/writes that raw structure instead of walking a generated descriptor,
 * giving the exact same `Map<String, Any>` shape the Android original's `DocumentSnapshot.getData()`
 * produced, without a hand-rolled contextual `Any` serializer or a domain-interface signature change.
 */
internal object FirestoreRawMapSerializer : KSerializer<Map<String, Any>> {

    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("FirestoreRawMap")

    override fun deserialize(decoder: Decoder): Map<String, Any> {
        val firebaseDecoder = decoder as? FirebaseDecoder
            ?: error("FirestoreRawMapSerializer only supports GitLive's FirebaseDecoder, got ${decoder::class}")
        @Suppress("UNCHECKED_CAST")
        return normalize(firebaseDecoder.value) as? Map<String, Any> ?: emptyMap()
    }

    override fun serialize(encoder: Encoder, value: Map<String, Any>) {
        val firebaseEncoder = encoder as? FirebaseEncoder
            ?: error("FirestoreRawMapSerializer only supports GitLive's FirebaseEncoder, got ${encoder::class}")
        firebaseEncoder.value = value
    }

    /**
     * Recursively coerces the raw native decode payload (nested `Map`/`List`/primitives) into
     * plain Kotlin collections. Map keys are coerced to `String` (Firestore field names always
     * are already); everything else passes through unchanged, same as Android's own
     * `DocumentSnapshot.getData()` never needing any conversion of its own.
     */
    private fun normalize(value: Any?): Any? = when (value) {
        null -> null
        is Map<*, *> -> value.entries.associate { (k, v) -> k.toString() to normalize(v) }
        is List<*> -> value.map { normalize(it) }
        else -> value
    }
}
