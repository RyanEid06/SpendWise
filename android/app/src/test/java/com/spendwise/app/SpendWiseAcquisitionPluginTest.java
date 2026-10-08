package com.spendwise.app;

import org.junit.Test;
import java.io.File;
import java.nio.file.Files;
import static org.junit.Assert.*;

public class SpendWiseAcquisitionPluginTest {
    @Test public void cleansOnlyKnownAcquisitionCopies() throws Exception {
        File root = Files.createTempDirectory("wp05-cache").toFile();
        File camera = new File(root, "PIC_20261007_120000.jpg");
        File picker = new File(root, "12345678-1234-1234-1234-123456789012.jpg");
        File plain = new File(root, ".Pic.jpg");
        File interrupted = new File(root, "IMG_20261007_120000.png");
        File providerCopy = new File(root, "12345678-1234-1234-1234-123456789012.heic");
        File providerWebp = new File(root, "22345678-1234-1234-1234-123456789012.webp");
        File other = new File(root, "user-photo.jpg");
        File secure = new File(root, "expense.swm");
        for (File file : new File[]{camera, picker, plain, interrupted, providerCopy, providerWebp, other, secure}) assertTrue(file.createNewFile());
        SpendWiseAcquisitionPlugin.cleanup(root);
        assertFalse(camera.exists()); assertFalse(picker.exists()); assertFalse(plain.exists());
        assertFalse(interrupted.exists()); assertFalse(providerCopy.exists()); assertFalse(providerWebp.exists());
        assertTrue(other.exists()); assertTrue(secure.exists());
    }

    @Test public void neverTraversesNestedMediaOrSymlinkTargets() throws Exception {
        File root = Files.createTempDirectory("wp05-cache").toFile();
        File outside = Files.createTempDirectory("wp05-user-media").toFile();
        File original = new File(outside, ".Pic.jpg"); assertTrue(original.createNewFile());
        File nested = new File(root, "saved"); assertTrue(nested.mkdir());
        File nestedPhoto = new File(nested, ".Pic.jpg"); assertTrue(nestedPhoto.createNewFile());
        Files.createSymbolicLink(new File(root, ".Pic.jpg").toPath(), original.toPath());
        SpendWiseAcquisitionPlugin.cleanup(root);
        assertTrue(original.exists()); assertTrue(nestedPhoto.exists());
    }
}
