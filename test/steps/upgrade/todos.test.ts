import { todosInDiff } from '../../../src/steps/upgrade/twopointoh/todos';

/**
 * A program driving the upgrade is told which @TODOs each step left, read
 * from that step's commit, so it has a worklist without searching the code.
 */
describe('the TODOs a step added', () => {
  it('are found with the line each now sits on', () => {
    const diff = `diff --git a/extend.php b/extend.php
index 1111111..2222222 100644
--- a/extend.php
+++ b/extend.php
@@ -12,0 +13 @@ return [
+    // @TODO: Replace with the new implementation
@@ -30,2 +31,3 @@ return [
-    (new Extend\\ApiSerializer(UserSerializer::class))
+    (new Extend\\ApiResource(UserResource::class))
+    // @TODO: move these attributes
+        ->fields(Api\\UserResourceFields::class),
`;

    expect(todosInDiff(diff)).toStrictEqual([
      { file: 'extend.php', line: 13, text: '// @TODO: Replace with the new implementation' },
      { file: 'extend.php', line: 32, text: '// @TODO: move these attributes' },
    ]);
  });

  it('include those in a file the step created', () => {
    const diff = `diff --git a/src/Api/Resource/ThingResource.php b/src/Api/Resource/ThingResource.php
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/Api/Resource/ThingResource.php
@@ -0,0 +1,3 @@
+<?php
+
+// @TODO migrate logic from old serializer and controllers to this API Resource.
`;

    expect(todosInDiff(diff)).toStrictEqual([
      {
        file: 'src/Api/Resource/ThingResource.php',
        line: 3,
        text: '// @TODO migrate logic from old serializer and controllers to this API Resource.',
      },
    ]);
  });

  it("leave out the extension's own TODOs that a step only reformatted or moved", () => {
    const diff = `diff --git a/js/src/forum/index.js b/js/src/forum/index.js
--- a/js/src/forum/index.js
+++ b/js/src/forum/index.js
@@ -3 +2,0 @@
-  // @TODO: our own note
@@ -9,0 +9 @@
+    // @TODO: our own note
`;

    expect(todosInDiff(diff)).toStrictEqual([]);
  });

  it('leave out a deleted file', () => {
    const diff = `diff --git a/old.php b/old.php
deleted file mode 100644
--- a/old.php
+++ /dev/null
@@ -1 +0,0 @@
-// @TODO: gone with the file
`;

    expect(todosInDiff(diff)).toStrictEqual([]);
  });
});
