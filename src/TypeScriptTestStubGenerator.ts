import BaseGenerator = require('./BaseGenerator');
import CompiledViewTemplate = require('./CompiledViewTemplate');

var _testStubPostFix = 'TestStub';
var _baseTestStubClass = 'TestStub';
var _getSubControLocationClass = 'GetSubControlLocation';

/// <summary>
/// Generates a TypeScript test stub class from a OneJS template.
/// </summary>
class TypeScriptTestStubGenerator extends BaseGenerator {

    public generate(templateContent: string): string {
        var template = this.template = this._getTemplate(templateContent);

        this._addImports(template)
        this._addClass(template);

        this._addLine();
        this._addLine('export = ' + template.name + _testStubPostFix + ';');

        return this.output;
    }

    private _addImports(template: CompiledViewTemplate) {
        var uniqueControlTypes: {
            [key: string]: {
                path: string;
                forceReference?: boolean;
            }
        } = {};

        uniqueControlTypes[_baseTestStubClass] = {
            path: '../onejs/' + _baseTestStubClass
        };

        uniqueControlTypes[template.baseViewType + _testStubPostFix] = {
            path: template.baseViewFullType + _testStubPostFix
        };

        function findImports(currentTemplate: CompiledViewTemplate) {
            var i;

            for (var memberName in currentTemplate.childViews) {

                if (!uniqueControlTypes[_getSubControLocationClass]) {
                    uniqueControlTypes[_getSubControLocationClass] = {
                        path: '../onejs/' + _getSubControLocationClass
                    };
                }

                var childViewDefinition = currentTemplate.childViews[memberName];

                if (childViewDefinition.shouldImport) {
                    uniqueControlTypes[childViewDefinition.type + _testStubPostFix] = {
                        path: childViewDefinition.fullType + _testStubPostFix
                    };
                }

                uniqueControlTypes[childViewDefinition.baseType + _testStubPostFix] = {
                    // TODO: calculate correct base path
                    path: childViewDefinition.fullBaseType + _testStubPostFix
                }
            }
            for (i = 0; i < currentTemplate.subTemplates.length; i++) {
                findImports(currentTemplate.subTemplates[i]);
            }
        }

        findImports(template);

        Object.keys(uniqueControlTypes).forEach((typeName) => {
            var controlType = uniqueControlTypes[typeName];

            var relativePath = controlType.path[0] === '.' ? controlType.path : './' + controlType.path;

            this._addLine('import ' + typeName + ' = require(\'' + relativePath + '\');');
        });
    }

    private _addClass(template: CompiledViewTemplate) {

        this._addLine();
        this._addLine('class ' + template.name + _testStubPostFix + ' extends ' + _baseTestStubClass + ' {');
        this._addProperties(template);
        this._addLine('}');
    }

    private _addProperties(template: CompiledViewTemplate) {
        this._addLine('originalViewName = \'' + template.name + '\';', 1);

        // Add properties
        for (var memberName in template.childViews) {
            var childViewDefinition = template.childViews[memberName];

            this._addLine(memberName + '(): ' + childViewDefinition.type + _testStubPostFix + ' {', 1);
            this._addLine('return new ' + childViewDefinition.type + _testStubPostFix + '(new ' + _getSubControLocationClass+'(\'' + memberName + '\', this.controlLocation, this.webDriver), this.webDriver);', 2);
            this._addLine('}', 1);
        }
    }
}


export = TypeScriptTestStubGenerator;