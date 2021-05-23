import { runStep } from "../../utils";

interface StubTest {
  stubClass: any;

  params: Record<string, unknown>;

  expectedModifiedFiles: string[];

  expectedExposedParams: Record<string, unknown>;
}

const testSpecs: StubTest[] = [

];

testSpecs.forEach(spec => {
  test(`Stub Test: ${spec.stubClass.name}`, async function () {
    const { fs } = await runStep(spec.stubClass, Object.values(spec.params));
  });
});
