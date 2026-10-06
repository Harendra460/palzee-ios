package expo.modules.videoexporter

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.text.TextPaint
import android.text.TextUtils
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.Presentation
import androidx.media3.effect.ScaleAndRotateTransformation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import com.google.common.collect.ImmutableList
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.URLDecoder
import java.util.UUID

/**
 * Android counterpart of ios/Palzee/VideoExporter.swift. Same method names, arguments and
 * resolved value (a file:// URI), so JS call sites work unchanged on both platforms.
 *
 * Output: 1080x1920 portrait canvas, black letterbox, each clip aspect-filled into a centered
 * 16:9 card (portrait clips rotated 270deg like the RN `rotate: '270deg'` preview), with
 * "vlog" / caption / timestamp text drawn across the card's vertical centre.
 */
@UnstableApi
class VideoExporterModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VideoExporter")

    AsyncFunction("exportPortraitVideoWithCaption") { inputPath: String, caption: String, timestamp: String, promise: Promise ->
      export(listOf(Clip(inputPath, Overlay.Full(caption, timestamp))), "collection_export", promise)
    }

    AsyncFunction("exportSlideshowVideo") { inputPaths: List<String>, captions: List<String>, timestamps: List<String>, promise: Promise ->
      if (inputPaths.isEmpty()) {
        promise.reject("ERR_NO_CLIPS", "No video clips provided for slideshow export", null)
        return@AsyncFunction
      }
      val clips = inputPaths.mapIndexed { i, path ->
        Clip(path, Overlay.Full(captions.getOrElse(i) { "" }, timestamps.getOrElse(i) { "" }))
      }
      export(clips, "collection_export", promise)
    }

    AsyncFunction("exportPortraitVideoSimple") { inputPath: String, promise: Promise ->
      export(listOf(Clip(inputPath, Overlay.Full("", ""))), "collection_export", promise)
    }

    AsyncFunction("exportRotatedCardVideoOnly") { inputPath: String, caption: String, promise: Promise ->
      export(listOf(Clip(inputPath, Overlay.CaptionOnly(caption))), "rotated_card", promise)
    }
  }

  private sealed class Overlay {
    data class Full(val caption: String, val timestamp: String) : Overlay()
    data class CaptionOnly(val caption: String) : Overlay()
  }

  private data class Clip(val path: String, val overlay: Overlay)

  private fun export(clips: List<Clip>, outputPrefix: String, promise: Promise) {
    val items = mutableListOf<EditedMediaItem>()
    for (clip in clips) {
      val uri = toUri(clip.path)
      val dims = displaySize(uri)
      if (dims == null) {
        // Mirrors iOS: a single unreadable clip is an error, unreadable slideshow clips are skipped.
        if (clips.size == 1) {
          promise.reject("ERR_NO_VIDEO", "No video track found at path: ${clip.path}", null)
          return
        }
        continue
      }
      items.add(buildItem(uri, isPortrait = dims.second > dims.first, overlay = clip.overlay))
    }
    if (items.isEmpty()) {
      promise.reject("ERR_NO_CLIPS", "No readable video clips provided for export", null)
      return
    }

    val output = File(context.cacheDir, "${outputPrefix}_${UUID.randomUUID()}.mp4")
    val composition = Composition.Builder(ImmutableList.of(EditedMediaItemSequence(items)))
      // Generates silence for clips recorded without audio so the sequence keeps one audio track.
      .experimentalSetForceAudioTrack(true)
      .build()

    Handler(Looper.getMainLooper()).post {
      try {
        val transformer = Transformer.Builder(context)
          .setVideoMimeType(MimeTypes.VIDEO_H264)
          .setAudioMimeType(MimeTypes.AUDIO_AAC)
          .setEncoderFactory(
            DefaultEncoderFactory.Builder(context)
              .setRequestedVideoEncoderSettings(
                VideoEncoderSettings.Builder().setBitrate(10_000_000).build()
              )
              .build()
          )
          .addListener(object : Transformer.Listener {
            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
              promise.resolve(Uri.fromFile(output).toString())
            }

            override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
              output.delete()
              promise.reject("ERR_EXPORT_FAILED", exportException.message ?: "Export failed", exportException)
            }
          })
          .build()
        transformer.start(composition, output.absolutePath)
      } catch (e: Exception) {
        promise.reject("ERR_EXPORT_INIT", e.message ?: "Failed to initialize export", e)
      }
    }
  }

  private fun buildItem(uri: Uri, isPortrait: Boolean, overlay: Overlay): EditedMediaItem {
    val effects = mutableListOf<androidx.media3.common.Effect>()
    if (isPortrait) {
      // Media3 rotates counter-clockwise: 90deg CCW == the 270deg clockwise used on iOS / in RN styles.
      effects.add(ScaleAndRotateTransformation.Builder().setRotationDegrees(90f).build())
    }
    // Aspect-fill into the 16:9 card, then letterbox the card into the 9:16 canvas.
    effects.add(Presentation.createForAspectRatio(16f / 9f, Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP))
    effects.add(Presentation.createForWidthAndHeight(CANVAS_W, CANVAS_H, Presentation.LAYOUT_SCALE_TO_FIT))
    effects.add(OverlayEffect(ImmutableList.of(BitmapOverlay.createStaticBitmapOverlay(renderOverlay(overlay)))))

    return EditedMediaItem.Builder(MediaItem.fromUri(uri))
      .setEffects(Effects(ImmutableList.of(), ImmutableList.copyOf(effects)))
      .build()
  }

  /** Full-canvas transparent bitmap with the text laid out like the CATextLayers on iOS. */
  private fun renderOverlay(overlay: Overlay): Bitmap {
    val bitmap = Bitmap.createBitmap(CANVAS_W, CANVAS_H, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val centerY = CANVAS_H / 2f

    fun paint(sizePx: Float, typeface: Typeface, align: Paint.Align) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = sizePx
      this.typeface = typeface
      textAlign = align
      setShadowLayer(4f, 0f, 2f, Color.argb(242, 0, 0, 0))
    }

    fun draw(text: String, p: TextPaint, x: Float, maxWidth: Float) {
      if (text.isEmpty()) return
      val fitted = TextUtils.ellipsize(text, p, maxWidth, TextUtils.TruncateAt.END).toString()
      val baseline = centerY - (p.descent() + p.ascent()) / 2f
      canvas.drawText(fitted, x, baseline, p)
    }

    val semibold = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    when (overlay) {
      is Overlay.Full -> {
        draw("vlog", paint(70f, Typeface.DEFAULT_BOLD, Paint.Align.LEFT), 40f, 360f)
        draw(overlay.caption, paint(60f, semibold, Paint.Align.CENTER), 540f, 440f)
        draw(overlay.timestamp, paint(60f, Typeface.DEFAULT, Paint.Align.RIGHT), 1040f, 270f)
      }
      is Overlay.CaptionOnly -> draw(overlay.caption, paint(60f, semibold, Paint.Align.CENTER), 540f, 800f)
    }
    return bitmap
  }

  /** Accepts file:// URIs (percent-encoded or not), bare paths, and content:// or http(s) URIs. */
  private fun toUri(path: String): Uri = when {
    path.startsWith("file://") -> Uri.fromFile(File(URLDecoder.decode(path.removePrefix("file://"), "UTF-8")))
    path.startsWith("/") -> Uri.fromFile(File(path))
    else -> Uri.parse(path)
  }

  /** Display (rotation-applied) width/height, or null when there is no readable video track. */
  private fun displaySize(uri: Uri): Pair<Int, Int>? {
    val retriever = MediaMetadataRetriever()
    return try {
      if (uri.scheme == "http" || uri.scheme == "https") {
        retriever.setDataSource(uri.toString(), HashMap())
      } else {
        retriever.setDataSource(context, uri)
      }
      if (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO) != "yes") return null
      val w = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: return null
      val h = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: return null
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      if (rotation % 180 != 0) h to w else w to h
    } catch (e: Exception) {
      null
    } finally {
      retriever.release()
    }
  }

  companion object {
    private const val CANVAS_W = 1080
    private const val CANVAS_H = 1920
  }
}
